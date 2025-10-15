import { useState, useEffect } from "react";
import { CloudRain, Plus, List, Pencil, Trash2, Calendar as CalendarIcon, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const locales = { 'en-US': require('date-fns/locale/en-US') };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

interface RainyDayActivity {
  id: string;
  name: string;
  date: string;
  time: string | null;
  location: string | null;
  activity_type: string;
  capacity: number | null;
  supervisor: string | null;
  notes: string | null;
  status: string;
}

export default function RainyDaySchedule() {
  const [activities, setActivities] = useState<RainyDayActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<RainyDayActivity | null>(null);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [calendarView, setCalendarView] = useState<View>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [formData, setFormData] = useState({
    name: "",
    date: "",
    time: "",
    location: "",
    activity_type: "indoor-games",
    capacity: "",
    supervisor: "",
    notes: "",
    status: "scheduled",
  });

  const fetchActivities = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("rainy_day_schedule")
      .select("*")
      .order("date", { ascending: true });

    if (!error && data) {
      setActivities(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchActivities();

    const channel = supabase
      .channel("rainy-day-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "rainy_day_schedule" }, () => { fetchActivities(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const dataToSubmit = {
      ...formData,
      capacity: formData.capacity ? parseInt(formData.capacity) : null,
    };

    if (editingActivity) {
      const { error } = await supabase
        .from("rainy_day_schedule")
        .update(dataToSubmit)
        .eq("id", editingActivity.id);

      if (error) {
        toast.error("Failed to update activity");
        console.error(error);
      } else {
        toast.success("Activity updated successfully");
        setDialogOpen(false);
        setEditingActivity(null);
        resetForm();
      }
    } else {
      const { error } = await supabase.from("rainy_day_schedule").insert([dataToSubmit]);

      if (error) {
        toast.error("Failed to add activity");
        console.error(error);
      } else {
        toast.success("Activity added successfully");
        setDialogOpen(false);
        resetForm();
      }
    }
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("rainy_day_schedule").delete().eq("id", id);

    if (error) {
      toast.error("Failed to delete activity");
      console.error(error);
    } else {
      toast.success("Activity deleted successfully");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      date: "",
      time: "",
      location: "",
      activity_type: "indoor-games",
      capacity: "",
      supervisor: "",
      notes: "",
      status: "scheduled",
    });
  };

  const openEditDialog = (activity: RainyDayActivity) => {
    setEditingActivity(activity);
    setFormData({
      name: activity.name,
      date: activity.date,
      time: activity.time || "",
      location: activity.location || "",
      activity_type: activity.activity_type,
      capacity: activity.capacity?.toString() || "",
      supervisor: activity.supervisor || "",
      notes: activity.notes || "",
      status: activity.status,
    });
    setDialogOpen(true);
  };

  const calendarEvents = activities.map(activity => ({
    id: activity.id,
    title: activity.name,
    start: new Date(activity.date + 'T00:00:00'),
    end: new Date(activity.date + 'T23:59:59'),
    resource: activity,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground mb-2">Rainy Day Schedule</h1>
          <p className="text-muted-foreground">Plan indoor activities for inclement weather</p>
        </div>
        <div className="flex gap-2">
          <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as any)}>
            <ToggleGroupItem value="calendar" aria-label="Calendar view">
              <CalendarIcon className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) {
              setEditingActivity(null);
              resetForm();
            }
          }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Activity</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingActivity ? "Edit Activity" : "Add Rainy Day Activity"}</DialogTitle>
                <DialogDescription>{editingActivity ? "Update the activity details" : "Schedule an indoor activity for rainy days"}</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleSubmit}>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Activity Name</Label>
                      <Input id="name" required placeholder="e.g., Movie Time" value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="activity_type">Activity Type</Label>
                      <Select value={formData.activity_type} onValueChange={(value) => setFormData({ ...formData, activity_type: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="indoor-games">Indoor Games</SelectItem>
                          <SelectItem value="arts-crafts">Arts & Crafts</SelectItem>
                          <SelectItem value="movie">Movie</SelectItem>
                          <SelectItem value="reading">Reading Time</SelectItem>
                          <SelectItem value="sports">Indoor Sports</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="date">Date</Label>
                      <Input id="date" type="date" required value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="time">Time</Label>
                      <Input id="time" type="time" value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <Input id="location" placeholder="e.g., Main Hall" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="capacity">Capacity</Label>
                      <Input id="capacity" type="number" placeholder="Max participants" value={formData.capacity} onChange={(e) => setFormData({ ...formData, capacity: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="supervisor">Supervisor</Label>
                      <Input id="supervisor" placeholder="Staff member name" value={formData.supervisor} onChange={(e) => setFormData({ ...formData, supervisor: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="status">Status</Label>
                      <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="scheduled">Scheduled</SelectItem>
                          <SelectItem value="in-progress">In Progress</SelectItem>
                          <SelectItem value="completed">Completed</SelectItem>
                          <SelectItem value="cancelled">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea id="notes" placeholder="Additional details or requirements..." value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="submit">{editingActivity ? "Update" : "Add"} Activity</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : activities.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CloudRain className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground">No rainy day activities scheduled yet</p>
          </CardContent>
        </Card>
      ) : viewMode === "calendar" ? (
        <Card>
          <CardContent className="p-6">
            <Calendar
              localizer={localizer}
              events={calendarEvents}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 600 }}
              view={calendarView}
              onView={setCalendarView}
              date={currentDate}
              onNavigate={setCurrentDate}
              onSelectEvent={(event) => openEditDialog(event.resource)}
              onSelectSlot={(slotInfo) => {
                setFormData({ ...formData, date: format(slotInfo.start, 'yyyy-MM-dd') });
                setDialogOpen(true);
              }}
              selectable
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {activities.map((activity) => (
            <Card key={activity.id} className="shadow-card hover:shadow-md transition-all group">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg mb-2">{activity.name}</CardTitle>
                    <Badge variant="outline" className="capitalize">{activity.activity_type.replace("-", " ")}</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity" onClick={() => openEditDialog(activity)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity text-destructive" onClick={() => handleDelete(activity.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span>{new Date(activity.date).toLocaleDateString()}</span>
                  {activity.time && <span>at {activity.time}</span>}
                </div>
                {activity.location && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{activity.location}</span>
                  </div>
                )}
                {activity.capacity && (
                  <div className="flex items-center gap-2 text-sm">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span>Capacity: {activity.capacity}</span>
                  </div>
                )}
                {activity.supervisor && <p className="text-sm text-muted-foreground">Supervisor: {activity.supervisor}</p>}
                {activity.notes && <p className="text-sm text-muted-foreground">{activity.notes}</p>}
                <Badge variant="outline" className={
                  activity.status === "scheduled" ? "bg-primary/10 text-primary border-primary/20" :
                  activity.status === "completed" ? "bg-success/10 text-success border-success/20" :
                  activity.status === "in-progress" ? "bg-warning/10 text-warning border-warning/20" :
                  "bg-muted text-muted-foreground"
                }>
                  {activity.status}
                </Badge>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}