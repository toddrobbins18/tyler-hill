import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Palmtree, Plus, List, Pencil, Trash2, Calendar as CalendarIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSeasonContext } from "@/contexts/SeasonContext";
import SeasonSelector from "@/components/SeasonSelector";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CSVUploader } from "@/components/CSVUploader";
import { Checkbox } from "@/components/ui/checkbox";
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

export default function ActivitiesFieldTrips() {
  const { currentSeason } = useSeasonContext();
  const [events, setEvents] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "division">("date");
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [calendarView, setCalendarView] = useState<View>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [formData, setFormData] = useState({
    event_date: new Date().toISOString().split('T')[0],
    title: "",
    description: "",
    activity_type: "",
    time: "",
    location: "",
    capacity: "",
    chaperone: "",
    division_id: "",
    meal_options: [] as string[],
    meal_notes: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchEvents();
    fetchDivisions();

    const channel = supabase
      .channel('field-trips-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'activities_field_trips' },
        () => fetchEvents()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentSeason]);

  const fetchEvents = async () => {
    // Fetch first batch (0-999)
    const { data: batch1, error: error1 } = await supabase
      .from("activities_field_trips")
      .select(`
        *,
        division:divisions(id, name, gender, sort_order)
      `)
      .order("event_date", { ascending: true })
      .range(0, 999);

    // Fetch second batch (1000-1999)
    const { data: batch2, error: error2 } = await supabase
      .from("activities_field_trips")
      .select(`
        *,
        division:divisions(id, name, gender, sort_order)
      `)
      .order("event_date", { ascending: true })
      .range(1000, 1999);

    // Combine batches
    const allData = [...(batch1 || []), ...(batch2 || [])];

    if (error1 || error2) {
      toast({ title: "Error fetching field trips", variant: "destructive" });
      setLoading(false);
      return;
    }

    // Filter by season in JavaScript
    const filteredData = allData.filter(event => 
      event.season === currentSeason || event.season === null
    );

    setEvents(filteredData);
    setLoading(false);
  };

  const fetchDivisions = async () => {
    const { data } = await supabase
      .from("divisions")
      .select("*")
      .order("sort_order");
    
    if (data) {
      setDivisions(data);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const submitData = {
      ...formData,
      division_id: formData.division_id || null,
      capacity: formData.capacity ? parseInt(formData.capacity) : null,
      meal_options: formData.meal_options,
      meal_notes: formData.meal_notes || null,
      season: currentSeason,
    };

    if (editingEvent) {
      const { error } = await supabase
        .from("activities_field_trips")
        .update(submitData)
        .eq("id", editingEvent.id);

      if (error) {
        toast({ title: "Error updating field trip", variant: "destructive" });
        return;
      }
      toast({ title: "Field trip updated successfully" });
    } else {
      const { error } = await supabase
        .from("activities_field_trips")
        .insert(submitData);

      if (error) {
        toast({ title: "Error adding field trip", variant: "destructive" });
        return;
      }

      // Create pending trip in transportation module
      const tripData = {
        name: formData.title,
        date: formData.event_date,
        type: "field_trip",
        event_type: formData.activity_type,
        destination: formData.location || null,
        departure_time: formData.time || null,
        capacity: formData.capacity ? parseInt(formData.capacity) : null,
        chaperone: formData.chaperone || null,
        status: "pending",
        season: currentSeason,
      };

      const { error: tripError } = await supabase
        .from("trips")
        .insert(tripData);

      if (tripError) {
        console.error("Error creating pending trip:", tripError);
      }

      toast({ title: "Activity added and pending trip created" });
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      event_date: new Date().toISOString().split('T')[0],
      title: "",
      description: "",
      activity_type: "",
      time: "",
      location: "",
      capacity: "",
      chaperone: "",
      division_id: "",
      meal_options: [],
      meal_notes: "",
    });
    setEditingEvent(null);
    setShowDialog(false);
    fetchEvents();
  };

  const handleEdit = (event: any) => {
    setEditingEvent(event);
    setFormData({
      event_date: event.event_date,
      title: event.title,
      description: event.description || "",
      activity_type: event.activity_type,
      time: event.time || "",
      location: event.location || "",
      capacity: event.capacity?.toString() || "",
      chaperone: event.chaperone || "",
      division_id: event.division_id || "",
      meal_options: event.meal_options || [],
      meal_notes: event.meal_notes || "",
    });
    setShowDialog(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    const { error } = await supabase
      .from("activities_field_trips")
      .delete()
      .eq("id", deletingId);

    if (error) {
      toast({ title: "Error deleting field trip", variant: "destructive" });
      return;
    }

    toast({ title: "Field trip deleted" });
    setDeletingId(null);
    fetchEvents();
  };

  const filteredAndSortedEvents = events
    .filter(event => selectedDivision === "all" || event.division_id === selectedDivision)
    .sort((a, b) => {
      if (sortBy === "division") {
        const divA = a.division?.sort_order || 999;
        const divB = b.division?.sort_order || 999;
        if (divA !== divB) return divA - divB;
      }
      return new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
    });

  const groupedEvents: Record<string, any[]> = filteredAndSortedEvents.reduce((acc, event) => {
    const date = new Date(event.event_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {} as Record<string, any[]>);

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <Palmtree className="h-8 w-8" />
              Activities & Field Trips
            </h1>
            <p className="text-muted-foreground">Schedule and manage activities and field trips for The Nest</p>
          </div>
          <SeasonSelector />
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
          <CSVUploader tableName="activities_field_trips" onUploadComplete={fetchEvents} />
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Activity
          </Button>
        </div>
      </div>

      <div className="flex gap-4">
        <select
          value={selectedDivision}
          onChange={(e) => setSelectedDivision(e.target.value)}
          className="px-4 py-2 border rounded-md bg-background"
        >
          <option value="all">All Divisions</option>
          {divisions.map((div) => (
            <option key={div.id} value={div.id}>
              {div.name}
            </option>
          ))}
        </select>
        {viewMode === "list" && (
          <Button 
            variant="outline"
            onClick={() => setSortBy(sortBy === "date" ? "division" : "date")}
          >
            Sort by {sortBy === "date" ? "Division" : "Date"}
          </Button>
        )}
      </div>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : filteredAndSortedEvents.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center">No activities or field trips scheduled</p>
          </CardContent>
        </Card>
      ) : viewMode === "calendar" ? (
        <Card>
          <CardContent className="p-6">
            <Calendar
              localizer={localizer}
              events={filteredAndSortedEvents.map(event => ({
                id: event.id,
                title: `${event.activity_type}: ${event.title}`,
                start: new Date(event.event_date + 'T00:00:00'),
                end: new Date(event.event_date + 'T23:59:59'),
                resource: event,
              }))}
              startAccessor="start"
              endAccessor="end"
              style={{ height: 600 }}
              view={calendarView}
              onView={setCalendarView}
              date={currentDate}
              onNavigate={setCurrentDate}
              onSelectEvent={(event: any) => handleEdit(event.resource)}
              onSelectSlot={(slotInfo: any) => {
                setFormData({ ...formData, event_date: format(slotInfo.start, 'yyyy-MM-dd') });
                setShowDialog(true);
              }}
              selectable
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedEvents).map(([month, monthEvents]) => (
            <div key={month}>
              <h2 className="text-xl font-semibold mb-3">{month}</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {monthEvents.map((event) => (
                  <Card key={event.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg">{event.title}</CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(event)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeletingId(event.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex gap-2 flex-wrap">
                        <Badge>{event.activity_type}</Badge>
                        {event.division && (
                          <Badge variant="secondary">{event.division.name}</Badge>
                        )}
                      </div>
                      {event.time && (
                        <p className="text-sm text-muted-foreground">⏰ {event.time}</p>
                      )}
                      {event.location && (
                        <p className="text-sm text-muted-foreground">📍 {event.location}</p>
                      )}
                      {event.capacity && (
                        <p className="text-sm text-muted-foreground">👥 Capacity: {event.capacity}</p>
                      )}
                      {event.chaperone && (
                        <p className="text-sm text-muted-foreground">👤 Chaperone: {event.chaperone}</p>
                      )}
                      {event.description && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {event.description}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Edit Activity/Field Trip' : 'Add Activity/Field Trip'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Event Date</Label>
              <Input
                type="date"
                value={formData.event_date}
                onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Title</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label>Activity Type</Label>
              <Select value={formData.activity_type} onValueChange={(value) => setFormData({ ...formData, activity_type: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select activity type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="field-trip">Field Trip</SelectItem>
                  <SelectItem value="arts-crafts">Arts & Crafts</SelectItem>
                  <SelectItem value="nature">Nature Activity</SelectItem>
                  <SelectItem value="water">Water Activity</SelectItem>
                  <SelectItem value="outdoor">Outdoor Adventure</SelectItem>
                  <SelectItem value="cultural">Cultural Activity</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Division (optional)</Label>
              <Select value={formData.division_id || "none"} onValueChange={(value) => setFormData({ ...formData, division_id: value === "none" ? "" : value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select division (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {divisions.map((division) => (
                    <SelectItem key={division.id} value={division.id}>
                      {division.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Time (optional)</Label>
              <Input
                type="time"
                value={formData.time}
                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Location (optional)</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Capacity (optional)</Label>
              <Input
                type="number"
                value={formData.capacity}
                onChange={(e) => setFormData({ ...formData, capacity: e.target.value })}
                placeholder="Maximum number of participants"
              />
            </div>

            <div className="space-y-2">
              <Label>Chaperone (optional)</Label>
              <Input
                value={formData.chaperone}
                onChange={(e) => setFormData({ ...formData, chaperone: e.target.value })}
                placeholder="Staff member name"
              />
            </div>

            <div className="space-y-2">
              <Label>Description (optional)</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
              />
            </div>

            <div className="space-y-3 border-t pt-4">
              <Label className="text-base font-semibold">Meal Options</Label>
              <div className="space-y-2">
                {['Breakfast', 'Snack', 'Lunch', 'Dinner', 'Other'].map((meal) => (
                  <div key={meal} className="flex items-center gap-2">
                    <Checkbox
                      id={`activity-meal-${meal}`}
                      checked={formData.meal_options.includes(meal)}
                      onCheckedChange={(checked) => {
                        const updated = checked
                          ? [...formData.meal_options, meal]
                          : formData.meal_options.filter(m => m !== meal);
                        setFormData({ ...formData, meal_options: updated });
                      }}
                    />
                    <label htmlFor={`activity-meal-${meal}`} className="text-sm cursor-pointer">
                      {meal}
                    </label>
                  </div>
                ))}
              </div>
              {formData.meal_options.includes('Other') && (
                <div className="space-y-2 mt-3">
                  <Label>Meal Notes</Label>
                  <Textarea
                    placeholder="e.g., Other location serves lunch"
                    value={formData.meal_notes}
                    onChange={(e) => setFormData({ ...formData, meal_notes: e.target.value })}
                    rows={2}
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => {
                setShowDialog(false);
                resetForm();
              }}>
                Cancel
              </Button>
              <Button type="submit">{editingEvent ? 'Update' : 'Add'} Activity</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Activity/Field Trip</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this activity? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
