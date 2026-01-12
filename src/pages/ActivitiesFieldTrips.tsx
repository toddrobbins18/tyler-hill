import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Palmtree, Plus, List, Pencil, Trash2, Calendar as CalendarIcon, CalendarRange } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CSVUploader } from "@/components/CSVUploader";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCompany } from "@/contexts/CompanyContext";
import { sortDivisionsGirlsFirst } from "@/lib/divisionUtils";

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

export default function ActivitiesFieldTrips() {
  const { currentSeason } = useSeasonContext();
  const { currentCompany } = useCompany();
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
    end_date: "",
    is_multi_day: false,
    title: "",
    description: "",
    activity_type: "",
    depart_from_camp: "",
    depart_from_activity: "",
    location: "",
    capacity: "",
    chaperone: "",
    division_ids: [] as string[],
    home_away: "" as "home" | "away" | "",
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
      .eq('company_id', currentCompany.id)
      .order("event_date", { ascending: true })
      .range(0, 999);

    // Fetch second batch (1000-1999)
    const { data: batch2, error: error2 } = await supabase
      .from("activities_field_trips")
      .select(`
        *,
        division:divisions(id, name, gender, sort_order)
      `)
      .eq('company_id', currentCompany.id)
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

    // Fetch division associations for each event
    const eventsWithDivisions = await Promise.all(
      filteredData.map(async (event) => {
        const { data: divisionLinks } = await supabase
          .from("activities_field_trips_divisions")
          .select("division_id, divisions(id, name, gender, sort_order)")
          .eq("activity_id", event.id);
        
        return {
          ...event,
          divisions: divisionLinks?.map(link => link.divisions).filter(Boolean) || []
        };
      })
    );

    setEvents(eventsWithDivisions);
    setLoading(false);
  };

  const fetchDivisions = async () => {
    if (!currentCompany?.id) {
      setDivisions([]);
      return;
    }
    const { data } = await supabase
      .from("divisions")
      .select("*")
      .eq('company_id', currentCompany.id)
      .eq('is_active', true);
    
    if (data) {
      setDivisions(sortDivisionsGirlsFirst(data));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const submitData = {
      event_date: formData.event_date,
      end_date: formData.is_multi_day ? formData.end_date : null,
      is_multi_day: formData.is_multi_day || false,
      title: formData.title,
      description: formData.description,
      activity_type: formData.activity_type,
      depart_from_camp: formData.depart_from_camp || null,
      depart_from_activity: formData.depart_from_activity || null,
      location: formData.location,
      capacity: formData.capacity ? parseInt(formData.capacity) : null,
      chaperone: formData.chaperone,
      home_away: formData.home_away || null,
      meal_options: formData.meal_options,
      meal_notes: formData.meal_notes || null,
      season: currentSeason,
      company_id: currentCompany?.id,
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

      // Update division associations
      await supabase
        .from("activities_field_trips_divisions")
        .delete()
        .eq("activity_id", editingEvent.id);

      if (formData.division_ids.length > 0) {
        await supabase
          .from("activities_field_trips_divisions")
          .insert(
            formData.division_ids.map(divId => ({
              activity_id: editingEvent.id,
              division_id: divId,
              company_id: currentCompany?.id,
            }))
          );
      }

      toast({ title: "Field trip updated successfully" });
    } else {
      const { data: newActivity, error } = await supabase
        .from("activities_field_trips")
        .insert(submitData)
        .select()
        .single();

      if (error || !newActivity) {
        toast({ title: "Error adding field trip", variant: "destructive" });
        return;
      }

      // Insert division associations
      if (formData.division_ids.length > 0) {
        await supabase
          .from("activities_field_trips_divisions")
          .insert(
            formData.division_ids.map(divId => ({
              activity_id: newActivity.id,
              division_id: divId,
              company_id: currentCompany?.id,
            }))
          );
      }

      // Only create trip if NOT a HOME event
      if (formData.home_away !== 'home') {
        const tripData = {
          name: formData.title,
          date: formData.event_date,
          end_date: formData.is_multi_day ? formData.end_date : null,
          is_multi_day: formData.is_multi_day || false,
          type: "field_trip",
          event_type: formData.activity_type,
          destination: formData.location || null,
          departure_time: formData.depart_from_camp || null,
          capacity: formData.capacity ? parseInt(formData.capacity) : null,
          chaperone: formData.chaperone || null,
          status: "pending",
          season: currentSeason,
          company_id: currentCompany?.id,
        };

        const { error: tripError } = await supabase
          .from("trips")
          .insert(tripData);

        if (tripError) {
          console.error("Error creating pending trip:", tripError);
        }
      }

      toast({ 
        title: formData.home_away === 'home' 
          ? "Activity added (no trip created for HOME event)" 
          : "Activity added and pending trip created" 
      });
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      event_date: new Date().toISOString().split('T')[0],
      end_date: "",
      is_multi_day: false,
      title: "",
      description: "",
      activity_type: "",
      depart_from_camp: "",
      depart_from_activity: "",
      location: "",
      capacity: "",
      chaperone: "",
      division_ids: [],
      home_away: "",
      meal_options: [],
      meal_notes: "",
    });
    setEditingEvent(null);
    setShowDialog(false);
    // Note: fetchEvents() is handled by realtime subscription
  };

  const handleEdit = async (event: any) => {
    setEditingEvent(event);
    
    // Fetch division associations
    const { data: divisionLinks } = await supabase
      .from("activities_field_trips_divisions")
      .select("division_id")
      .eq("activity_id", event.id);
    
    setFormData({
      event_date: event.event_date,
      end_date: event.end_date || "",
      is_multi_day: event.is_multi_day || false,
      title: event.title,
      description: event.description || "",
      activity_type: event.activity_type,
      depart_from_camp: event.depart_from_camp || "",
      depart_from_activity: event.depart_from_activity || "",
      location: event.location || "",
      capacity: event.capacity?.toString() || "",
      chaperone: event.chaperone || "",
      division_ids: divisionLinks?.map(link => link.division_id) || [],
      home_away: event.home_away || "",
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
    .filter(event => {
      if (selectedDivision === "all") return true;
      // Check if any of the event's divisions match the selected division
      return event.divisions?.some((div: any) => div.id === selectedDivision);
    })
    .sort((a, b) => {
      if (sortBy === "division") {
        const divA = a.divisions?.[0];
        const divB = b.divisions?.[0];
        
        if (!divA && !divB) return 0;
        if (!divA) return 1;
        if (!divB) return -1;
        
        // Sort by gender first (girls before boys)
        const genderOrder = { female: 0, male: 1 };
        const genderA = genderOrder[divA.gender?.toLowerCase() as keyof typeof genderOrder] ?? 2;
        const genderB = genderOrder[divB.gender?.toLowerCase() as keyof typeof genderOrder] ?? 2;
        
        if (genderA !== genderB) return genderA - genderB;
        
        // Within same gender, sort by sort_order
        return (divA.sort_order || 999) - (divB.sort_order || 999);
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
                title: `${event.activity_type}: ${event.title}${event.is_multi_day ? ' (Multi-Day)' : ''}`,
                start: new Date(event.event_date + 'T00:00:00'),
                end: event.is_multi_day && event.end_date 
                  ? new Date(event.end_date + 'T23:59:59')
                  : new Date(event.event_date + 'T23:59:59'),
                resource: event,
                allDay: true,
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
                          <CardTitle className="text-lg flex items-center gap-2">
                            {event.title}
                            {event.is_multi_day && (
                              <CalendarRange className="h-4 w-4 text-muted-foreground" />
                            )}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {event.is_multi_day && event.end_date ? (
                              <>
                                {format(new Date(event.event_date), 'MMM d')} - {format(new Date(event.end_date), 'MMM d, yyyy')}
                              </>
                            ) : (
                              new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                            )}
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
                        {event.is_multi_day && event.end_date && (
                          (() => {
                            const start = new Date(event.event_date);
                            const end = new Date(event.end_date);
                            const diffTime = Math.abs(end.getTime() - start.getTime());
                            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                            return (
                              <Badge variant="secondary" className="flex items-center gap-1">
                                <CalendarRange className="h-3 w-3" />
                                {diffDays}-Day
                              </Badge>
                            );
                          })()
                        )}
                        {event.home_away && (
                          <Badge variant="outline">{event.home_away.toUpperCase()}</Badge>
                        )}
                        {event.divisions?.map((div: any) => (
                          <Badge key={div.id} variant="secondary">{div.name}</Badge>
                        ))}
                      </div>
                      {(event.depart_from_camp || event.depart_from_activity) && (
                        <p className="text-sm text-muted-foreground">
                          ⏰ {event.depart_from_camp && `Depart: ${event.depart_from_camp}`}
                          {event.depart_from_camp && event.depart_from_activity && ' | '}
                          {event.depart_from_activity && `Return: ${event.depart_from_activity}`}
                        </p>
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
            {/* Multi-day toggle */}
            <div className="flex flex-row items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <Label className="text-base flex items-center gap-2">
                  <CalendarRange className="h-4 w-4" />
                  Multi-Day Event
                </Label>
                <p className="text-sm text-muted-foreground">
                  Enable this for events spanning multiple days
                </p>
              </div>
              <Switch
                checked={formData.is_multi_day}
                onCheckedChange={(checked) => {
                  setFormData({ 
                    ...formData, 
                    is_multi_day: checked,
                    end_date: checked ? formData.end_date : ""
                  });
                }}
              />
            </div>

            {/* Date fields */}
            <div className={`grid ${formData.is_multi_day ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
              <div className="space-y-2">
                <Label>{formData.is_multi_day ? "Start Date" : "Event Date"}</Label>
                <Input
                  type="date"
                  value={formData.event_date}
                  onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                  required
                />
              </div>

              {formData.is_multi_day && (
                <div className="space-y-2">
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={formData.end_date}
                    onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                    min={formData.event_date}
                    required={formData.is_multi_day}
                  />
                </div>
              )}
            </div>

            {/* Duration badge */}
            {formData.is_multi_day && formData.event_date && formData.end_date && (
              (() => {
                const start = new Date(formData.event_date);
                const end = new Date(formData.end_date);
                if (end > start) {
                  const diffTime = Math.abs(end.getTime() - start.getTime());
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
                  return (
                    <Badge variant="secondary" className="flex items-center gap-1 w-fit">
                      <CalendarRange className="h-3 w-3" />
                      {diffDays}-Day Event
                    </Badge>
                  );
                }
                return null;
              })()
            )}

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
              <Label>Location Type</Label>
              <Select value={formData.home_away || "none"} onValueChange={(value) => setFormData({ ...formData, home_away: value === "none" ? "" : value as any })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location type (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Not Specified</SelectItem>
                  <SelectItem value="home">HOME</SelectItem>
                  <SelectItem value="away">AWAY</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Divisions (select multiple)</Label>
              <div className="border rounded-md p-4 space-y-2 max-h-48 overflow-y-auto">
                {divisions.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No divisions available</p>
                ) : (
                  divisions.map((division) => (
                    <div key={division.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`div-${division.id}`}
                        checked={formData.division_ids.includes(division.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setFormData({
                              ...formData,
                              division_ids: [...formData.division_ids, division.id]
                            });
                          } else {
                            setFormData({
                              ...formData,
                              division_ids: formData.division_ids.filter(id => id !== division.id)
                            });
                          }
                        }}
                      />
                      <label
                        htmlFor={`div-${division.id}`}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {division.name}
                      </label>
                    </div>
                  ))
                )}
              </div>
              <p className="text-xs text-muted-foreground">Leave unchecked for all divisions</p>
            </div>

            <div className="space-y-2">
              <Label>Depart from Camp (optional)</Label>
              <Input
                type="time"
                value={formData.depart_from_camp}
                onChange={(e) => setFormData({ ...formData, depart_from_camp: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Depart from Activity (optional)</Label>
              <Input
                type="time"
                value={formData.depart_from_activity}
                onChange={(e) => setFormData({ ...formData, depart_from_activity: e.target.value })}
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
