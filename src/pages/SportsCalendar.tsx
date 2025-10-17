import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Plus, List, Pencil, Trash2, Calendar as CalendarIcon, UserCheck, Search, X, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CSVUploader } from "@/components/CSVUploader";
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import ManageSportsRosterDialog from "@/components/dialogs/ManageSportsRosterDialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

export default function SportsCalendar() {
  const { currentSeason } = useSeasonContext();
  const [events, setEvents] = useState<any[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [selectedDivisions, setSelectedDivisions] = useState<string[]>([]);
  const [selectedGender, setSelectedGender] = useState<string>("all");
  const [selectedSport, setSelectedSport] = useState<string>("all");
  const [selectedEventType, setSelectedEventType] = useState<string>("all");
  const [selectedLocation, setSelectedLocation] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [sortBy, setSortBy] = useState<"date" | "division" | "sport" | "location" | "eventType">("date");
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [managingRoster, setManagingRoster] = useState<{ id: string; title: string } | null>(null);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [calendarView, setCalendarView] = useState<View>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [showRosterPopup, setShowRosterPopup] = useState<any>(null);
  const [rosterCounts, setRosterCounts] = useState<Record<string, number>>({});
  const [formData, setFormData] = useState({
    event_date: new Date().toISOString().split('T')[0],
    title: "",
    description: "",
    sport_type: "",
    custom_sport_type: "",
    event_type: "",
    time: "",
    location: "",
    team: "",
    opponent: "",
    home_away: "",
    division_ids: [] as string[],
    division_provides_coach: false,
    division_provides_ref: false,
    meal_options: [] as string[],
    meal_notes: "",
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchEvents();
    fetchDivisions();

    const channel = supabase
      .channel('sports-calendar-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sports_calendar' },
        () => fetchEvents()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentSeason]);

  const fetchEvents = async () => {
    const { data, error } = await supabase
      .from("sports_calendar")
      .select(`
        *,
        division:divisions(id, name, gender, sort_order),
        sports_calendar_divisions(division_id, division:divisions(id, name, gender, sort_order))
      `)
      .eq("season", currentSeason)
      .order("event_date", { ascending: true });

    if (error) {
      toast({ title: "Error fetching events", variant: "destructive" });
      setLoading(false);
      return;
    }

    // Fetch roster counts
    const { data: rosterData } = await supabase
      .from("sports_event_roster")
      .select("event_id");

    const counts: Record<string, number> = {};
    rosterData?.forEach((item) => {
      counts[item.event_id] = (counts[item.event_id] || 0) + 1;
    });
    setRosterCounts(counts);

    setEvents(data || []);
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

    if (!formData.sport_type && !formData.custom_sport_type) {
      toast({ title: "Please select or enter a sport type", variant: "destructive" });
      return;
    }

    const submitData = {
      event_date: formData.event_date,
      title: formData.title,
      description: formData.description,
      sport_type: formData.sport_type === "Other" ? "Other" : formData.sport_type,
      custom_sport_type: formData.sport_type === "Other" || formData.event_type === "Other" ? formData.custom_sport_type : null,
      event_type: formData.event_type || null,
      time: formData.time,
      location: formData.location,
      team: formData.team,
      opponent: formData.opponent,
      home_away: formData.home_away || null,
      division_id: formData.division_ids.length === 1 ? formData.division_ids[0] : null,
      division_provides_coach: formData.division_provides_coach,
      division_provides_ref: formData.division_provides_ref,
      meal_options: formData.meal_options,
      meal_notes: formData.meal_notes || null,
    };

    if (editingEvent) {
      const { error } = await supabase
        .from("sports_calendar")
        .update(submitData)
        .eq("id", editingEvent.id);

      if (error) {
        toast({ title: "Error updating event", variant: "destructive" });
        return;
      }

      // Update junction table
      await supabase.from("sports_calendar_divisions").delete().eq("sports_event_id", editingEvent.id);
      if (formData.division_ids.length > 0) {
        const junctionData = formData.division_ids.map(divId => ({
          sports_event_id: editingEvent.id,
          division_id: divId
        }));
        await supabase.from("sports_calendar_divisions").insert(junctionData);
      }

      toast({ title: "Event updated successfully" });
    } else {
      const { data: newEvent, error } = await supabase
        .from("sports_calendar")
        .insert(submitData)
        .select()
        .single();

      if (error || !newEvent) {
        toast({ title: "Error adding event", variant: "destructive" });
        return;
      }

      // Insert into junction table
      if (formData.division_ids.length > 0) {
        const junctionData = formData.division_ids.map(divId => ({
          sports_event_id: newEvent.id,
          division_id: divId
        }));
        await supabase.from("sports_calendar_divisions").insert(junctionData);
      }

      // Create pending trip in transportation module linked to this sports event
      const tripData = {
        name: formData.title,
        date: formData.event_date,
        type: "sporting_event",
        event_type: formData.sport_type === "Other" ? formData.custom_sport_type : formData.sport_type,
        destination: formData.location || null,
        departure_time: formData.time || null,
        status: "pending",
        sports_event_id: newEvent.id,
      };

      await supabase.from("trips").insert(tripData);

      toast({ title: "Sports event added and pending trip created" });
    }

    resetForm();
  };

  const resetForm = () => {
    setFormData({
      event_date: new Date().toISOString().split('T')[0],
      title: "",
      description: "",
      sport_type: "",
      custom_sport_type: "",
      event_type: "",
      time: "",
      location: "",
      team: "",
      opponent: "",
      home_away: "",
      division_ids: [],
      division_provides_coach: false,
      division_provides_ref: false,
      meal_options: [],
      meal_notes: "",
    });
    setEditingEvent(null);
    setShowDialog(false);
    fetchEvents();
  };

  const handleEdit = (event: any) => {
    setEditingEvent(event);
    const divisionIds = event.sports_calendar_divisions?.map((d: any) => d.division_id) || 
                        (event.division_id ? [event.division_id] : []);
    setFormData({
      event_date: event.event_date,
      title: event.title,
      description: event.description || "",
      sport_type: event.sport_type,
      custom_sport_type: event.custom_sport_type || "",
      event_type: event.event_type || "",
      time: event.time || "",
      location: event.location || "",
      team: event.team || "",
      opponent: event.opponent || "",
      home_away: event.home_away || "",
      division_ids: divisionIds,
      division_provides_coach: event.division_provides_coach || false,
      division_provides_ref: event.division_provides_ref || false,
      meal_options: event.meal_options || [],
      meal_notes: event.meal_notes || "",
    });
    setShowDialog(true);
  };

  const handleDelete = async () => {
    if (!deletingId) return;

    const { error } = await supabase
      .from("sports_calendar")
      .delete()
      .eq("id", deletingId);

    if (error) {
      toast({ title: "Error deleting event", variant: "destructive" });
      return;
    }

    toast({ title: "Event deleted" });
    setDeletingId(null);
    fetchEvents();
  };

  const getEventDivisions = (event: any) => {
    if (event.sports_calendar_divisions && event.sports_calendar_divisions.length > 0) {
      return event.sports_calendar_divisions.map((d: any) => d.division);
    }
    return event.division ? [event.division] : [];
  };

  const getDisplaySport = (event: any) => {
    return event.custom_sport_type || event.sport_type;
  };

  const getRosterCount = (eventId: string) => {
    return rosterCounts[eventId] || 0;
  };

  const getRosterIndicatorClass = (eventId: string) => {
    const count = getRosterCount(eventId);
    if (count === 0) {
      return "border-l-4 border-red-500 bg-red-50 dark:bg-red-950/20";
    }
    return "border-l-4 border-green-500 bg-green-50 dark:bg-green-950/20";
  };

  const eventPropGetter = (event: any) => {
    const rosterCount = getRosterCount(event.resource.id);
    const homeAway = event.resource.home_away;
    
    let backgroundColor = rosterCount === 0 ? '#ef4444' : '#22c55e';
    let borderColor = homeAway === 'home' ? '#3b82f6' : homeAway === 'away' ? '#ec4899' : 'transparent';
    
    return {
      style: {
        backgroundColor,
        borderLeft: `4px solid ${borderColor}`,
        color: 'white',
        borderRadius: '4px',
        padding: '2px 5px',
      }
    };
  };

  const uniqueSports = Array.from(new Set(events.map(e => getDisplaySport(e)))).filter(Boolean).sort();
  const uniqueEventTypes = Array.from(new Set(events.map(e => e.event_type))).filter(Boolean).sort();
  const uniqueLocations = Array.from(new Set(events.map(e => e.location))).filter(Boolean).sort();

  const filteredAndSortedEvents = events
    .filter(event => {
      // Division filter
      if (selectedDivisions.length > 0) {
        const eventDivisions = getEventDivisions(event);
        const hasMatchingDivision = eventDivisions.some((d: any) => 
          selectedDivisions.includes(d.id)
        );
        if (!hasMatchingDivision) return false;
      }

      // Gender filter
      if (selectedGender !== "all") {
        const eventDivisions = getEventDivisions(event);
        const hasMatchingGender = eventDivisions.some((d: any) => 
          d.gender.toLowerCase() === selectedGender.toLowerCase()
        );
        if (!hasMatchingGender) return false;
      }

      // Sport filter
      if (selectedSport !== "all") {
        const displaySport = getDisplaySport(event);
        if (displaySport !== selectedSport) return false;
      }

      // Event type filter
      if (selectedEventType !== "all" && event.event_type !== selectedEventType) return false;

      // Location filter
      if (selectedLocation !== "all" && event.location !== selectedLocation) return false;

      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const searchableFields = [
          event.title,
          event.description,
          event.location,
          event.team,
          event.opponent,
          getDisplaySport(event),
          event.event_type
        ].filter(Boolean).join(" ").toLowerCase();
        
        if (!searchableFields.includes(search)) return false;
      }

      return true;
    })
    .sort((a, b) => {
      if (sortBy === "division") {
        const divA = getEventDivisions(a)[0]?.sort_order || 999;
        const divB = getEventDivisions(b)[0]?.sort_order || 999;
        if (divA !== divB) return divA - divB;
      } else if (sortBy === "sport") {
        return getDisplaySport(a).localeCompare(getDisplaySport(b));
      } else if (sortBy === "location") {
        return (a.location || "").localeCompare(b.location || "");
      } else if (sortBy === "eventType") {
        return (a.event_type || "").localeCompare(b.event_type || "");
      }
      
      // Default or date sort
      const dateCompare = new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
      if (dateCompare !== 0) return dateCompare;
      
      // If same date, sort by time
      if (a.time && b.time) {
        return a.time.localeCompare(b.time);
      }
      return a.time ? -1 : b.time ? 1 : 0;
    });

  const groupedEvents: Record<string, any[]> = filteredAndSortedEvents.reduce((acc, event) => {
    const date = new Date(event.event_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {} as Record<string, any[]>);

  const activeFilterCount = (selectedDivisions.length > 0 ? 1 : 0) + 
    (selectedGender !== "all" ? 1 : 0) + 
    (selectedSport !== "all" ? 1 : 0) + 
    (selectedEventType !== "all" ? 1 : 0) + 
    (selectedLocation !== "all" ? 1 : 0) + 
    (searchTerm ? 1 : 0);

  const clearAllFilters = () => {
    setSelectedDivisions([]);
    setSelectedGender("all");
    setSelectedSport("all");
    setSelectedEventType("all");
    setSelectedLocation("all");
    setSearchTerm("");
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Trophy className="h-8 w-8" />
            Sports Calendar
          </h1>
          <p className="text-muted-foreground">Track sports events and games</p>
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
          <CSVUploader tableName="sports_calendar" onUploadComplete={fetchEvents} />
          <Button onClick={() => setShowDialog(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Event
          </Button>
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Search events..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline">
                  Divisions {selectedDivisions.length > 0 && `(${selectedDivisions.length})`}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[250px]">
                <div className="space-y-2">
                  <p className="font-semibold text-sm">Select Divisions</p>
                  {divisions.map((div) => (
                    <div key={div.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`div-${div.id}`}
                        checked={selectedDivisions.includes(div.id)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedDivisions([...selectedDivisions, div.id]);
                          } else {
                            setSelectedDivisions(selectedDivisions.filter(id => id !== div.id));
                          }
                        }}
                      />
                      <label htmlFor={`div-${div.id}`} className="text-sm cursor-pointer">
                        {div.name}
                      </label>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>

            <Select value={selectedGender} onValueChange={setSelectedGender}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Genders</SelectItem>
                <SelectItem value="boys">Boys</SelectItem>
                <SelectItem value="girls">Girls</SelectItem>
              </SelectContent>
            </Select>

            <Select value={selectedSport} onValueChange={setSelectedSport}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sports</SelectItem>
                {uniqueSports.map(sport => (
                  <SelectItem key={sport} value={sport}>{sport}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedEventType} onValueChange={setSelectedEventType}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Event Types</SelectItem>
                {uniqueEventTypes.map(type => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={selectedLocation} onValueChange={setSelectedLocation}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations</SelectItem>
                {uniqueLocations.map(loc => (
                  <SelectItem key={loc} value={loc}>{loc}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">Sort by Date</SelectItem>
                <SelectItem value="division">Sort by Division</SelectItem>
                <SelectItem value="sport">Sort by Sport</SelectItem>
                <SelectItem value="location">Sort by Location</SelectItem>
                <SelectItem value="eventType">Sort by Event Type</SelectItem>
              </SelectContent>
            </Select>

            {activeFilterCount > 0 && (
              <Button variant="ghost" onClick={clearAllFilters}>
                <X className="h-4 w-4 mr-2" />
                Clear ({activeFilterCount})
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : filteredAndSortedEvents.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center">No sports events match your filters</p>
          </CardContent>
        </Card>
      ) : viewMode === "calendar" ? (
        <Card>
          <CardContent className="p-6">
            <Calendar
              localizer={localizer}
              events={filteredAndSortedEvents.map(event => ({
                id: event.id,
                title: `${getDisplaySport(event)}: ${event.title}`,
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
              onSelectEvent={(event: any) => setShowRosterPopup(event.resource)}
              onSelectSlot={(slotInfo: any) => {
                setFormData({ ...formData, event_date: format(slotInfo.start, 'yyyy-MM-dd') });
                setShowDialog(true);
              }}
              eventPropGetter={eventPropGetter}
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
                  <Card key={event.id} className={`hover:shadow-lg transition-shadow ${getRosterIndicatorClass(event.id)}`}>
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
                            onClick={() => setShowRosterPopup(event)}
                            title="View Roster"
                          >
                            <Users className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setManagingRoster({ id: event.id, title: event.title })}
                            title="Manage Roster"
                          >
                            <UserCheck className="h-4 w-4" />
                          </Button>
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
                        <Badge>{getDisplaySport(event)}</Badge>
                        {event.event_type && (
                          <Badge variant="outline">{event.event_type}</Badge>
                        )}
                        {getEventDivisions(event).map((div: any, idx: number) => (
                          <Badge key={idx} variant="secondary">{div.name}</Badge>
                        ))}
                        <Badge variant={getRosterCount(event.id) === 0 ? "destructive" : "default"}>
                          {getRosterCount(event.id)} roster
                        </Badge>
                      </div>
                      {event.time && (
                        <p className="text-sm text-muted-foreground">⏰ {event.time}</p>
                      )}
                      {event.location && (
                        <p className="text-sm text-muted-foreground">📍 {event.location}</p>
                      )}
                      {event.team && event.opponent && (
                        <p className="text-sm font-medium">{event.team} vs {event.opponent}</p>
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

      {/* Roster Quick View Dialog */}
      {showRosterPopup && (
        <Dialog open={!!showRosterPopup} onOpenChange={() => setShowRosterPopup(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{showRosterPopup.title}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${getRosterCount(showRosterPopup.id) === 0 ? 'bg-red-100 dark:bg-red-950' : 'bg-green-100 dark:bg-green-950'}`}>
                  <Users className="h-6 w-6" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Roster Count</p>
                  <p className="text-2xl font-bold">{getRosterCount(showRosterPopup.id)}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button 
                  onClick={() => {
                    setManagingRoster({ id: showRosterPopup.id, title: showRosterPopup.title });
                    setShowRosterPopup(null);
                  }}
                  className="flex-1"
                >
                  <UserCheck className="h-4 w-4 mr-2" />
                  Manage Roster
                </Button>
                <Button variant="outline" onClick={() => handleEdit(showRosterPopup)}>
                  <Pencil className="h-4 w-4 mr-2" />
                  Edit Event
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={showDialog} onOpenChange={(open) => {
        setShowDialog(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingEvent ? 'Edit Sports Event' : 'Add Sports Event'}</DialogTitle>
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
              <Label>Sport Type *</Label>
              <Select 
                value={formData.sport_type} 
                onValueChange={(value) => setFormData({ ...formData, sport_type: value })}
                required
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select sport type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Baseball">Baseball</SelectItem>
                  <SelectItem value="Basketball">Basketball</SelectItem>
                  <SelectItem value="Dance">Dance</SelectItem>
                  <SelectItem value="Football">Football</SelectItem>
                  <SelectItem value="Golf">Golf</SelectItem>
                  <SelectItem value="Gymnastics">Gymnastics</SelectItem>
                  <SelectItem value="Hockey">Hockey</SelectItem>
                  <SelectItem value="Lacrosse">Lacrosse</SelectItem>
                  <SelectItem value="Soccer">Soccer</SelectItem>
                  <SelectItem value="Softball">Softball</SelectItem>
                  <SelectItem value="Tennis">Tennis</SelectItem>
                  <SelectItem value="Volleyball">Volleyball</SelectItem>
                  <SelectItem value="Waterfront">Waterfront</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.sport_type === "Other" && (
              <div className="space-y-2">
                <Label>Custom Sport Type *</Label>
                <Input
                  value={formData.custom_sport_type}
                  onChange={(e) => setFormData({ ...formData, custom_sport_type: e.target.value })}
                  placeholder="Enter sport name"
                  required
                />
              </div>
            )}

            <div className="space-y-2">
              <Label>Event Type</Label>
              <Select value={formData.event_type} onValueChange={(value) => setFormData({ ...formData, event_type: value })} required>
                <SelectTrigger>
                  <SelectValue placeholder="Select event type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="WC One Day Tournament">WC One Day Tournament</SelectItem>
                  <SelectItem value="WC Knock Out Tournament">WC Knock Out Tournament</SelectItem>
                  <SelectItem value="Exhibition/Friendly">Exhibition/Friendly</SelectItem>
                  <SelectItem value="Invitational">Invitational</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
              {formData.event_type === "Other" && (
                <Input
                  placeholder="Specify event type"
                  value={formData.custom_sport_type}
                  onChange={(e) => setFormData({ ...formData, custom_sport_type: e.target.value })}
                  required
                  className="mt-2"
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>Divisions (optional)</Label>
              <div className="border rounded-md p-3 space-y-2 max-h-[200px] overflow-y-auto">
                {divisions.map((div) => (
                  <div key={div.id} className="flex items-center gap-2">
                    <Checkbox
                      id={`form-div-${div.id}`}
                      checked={formData.division_ids.includes(div.id)}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({ ...formData, division_ids: [...formData.division_ids, div.id] });
                        } else {
                          setFormData({ ...formData, division_ids: formData.division_ids.filter(id => id !== div.id) });
                        }
                      }}
                    />
                    <label htmlFor={`form-div-${div.id}`} className="text-sm cursor-pointer">
                      {div.name}
                    </label>
                  </div>
                ))}
              </div>
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
              <Label>Team (optional)</Label>
              <Input
                value={formData.team}
                onChange={(e) => setFormData({ ...formData, team: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Opponent (optional)</Label>
              <Input
                value={formData.opponent}
                onChange={(e) => setFormData({ ...formData, opponent: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label>Home or Away</Label>
              <Select value={formData.home_away} onValueChange={(value) => setFormData({ ...formData, home_away: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="home">Home</SelectItem>
                  <SelectItem value="away">Away</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                </SelectContent>
              </Select>
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
                      id={`meal-${meal}`}
                      checked={formData.meal_options.includes(meal)}
                      onCheckedChange={(checked) => {
                        const updated = checked
                          ? [...formData.meal_options, meal]
                          : formData.meal_options.filter(m => m !== meal);
                        setFormData({ ...formData, meal_options: updated });
                      }}
                    />
                    <label htmlFor={`meal-${meal}`} className="text-sm cursor-pointer">
                      {meal}
                    </label>
                  </div>
                ))}
              </div>
              {formData.meal_options.includes('Other') && (
                <div className="space-y-2 mt-3">
                  <Label>Meal Notes</Label>
                  <Textarea
                    placeholder="e.g., Other camp serves lunch"
                    value={formData.meal_notes}
                    onChange={(e) => setFormData({ ...formData, meal_notes: e.target.value })}
                    rows={2}
                  />
                </div>
              )}
            </div>

            <div className="space-y-3 border-t pt-4">
              <Label className="text-base font-semibold">Staff Assignment</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="division-coach"
                  checked={formData.division_provides_coach}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      division_provides_coach: checked as boolean,
                    })
                  }
                />
                <label
                  htmlFor="division-coach"
                  className="text-sm cursor-pointer"
                >
                  Division will provide coach
                </label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="division-ref"
                  checked={formData.division_provides_ref}
                  onCheckedChange={(checked) =>
                    setFormData({
                      ...formData,
                      division_provides_ref: checked as boolean,
                    })
                  }
                />
                <label
                  htmlFor="division-ref"
                  className="text-sm cursor-pointer"
                >
                  Division will provide ref
                </label>
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button type="button" variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>
                Cancel
              </Button>
              <Button type="submit">
                {editingEvent ? 'Update Event' : 'Add Event'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(open) => !open && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Event?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete the sports event.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {managingRoster && (
        <ManageSportsRosterDialog
          eventId={managingRoster.id}
          eventTitle={managingRoster.title}
          open={!!managingRoster}
          onOpenChange={(open) => {
            if (!open) {
              setManagingRoster(null);
              fetchEvents(); // Refresh to update roster counts
            }
          }}
          divisionProvidesCoach={events.find(e => e.id === managingRoster.id)?.division_provides_coach}
          divisionProvidesRef={events.find(e => e.id === managingRoster.id)?.division_provides_ref}
        />
      )}
    </div>
  );
}
