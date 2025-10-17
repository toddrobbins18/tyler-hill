import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Calendar as CalendarIcon, Plus, List, Pencil, Trash2, Search, X, Trophy, Users, Star, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { formatTime12Hour } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

type EventSource = 'sports_calendar' | 'activities_field_trips' | 'special_events_activities' | 'master_calendar';

interface UnifiedEvent {
  id: string;
  title: string;
  event_date: string;
  time?: string;
  location?: string;
  description?: string;
  source: EventSource;
  type: string;
  division?: any;
  originalData: any;
}

export default function MasterCalendar() {
  const [events, setEvents] = useState<UnifiedEvent[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [children, setChildren] = useState<any[]>([]);
  const [staff, setStaff] = useState<any[]>([]);
  const [selectedDivision, setSelectedDivision] = useState<string>("all");
  const [searchName, setSearchName] = useState<string>("");
  const [searchLocation, setSearchLocation] = useState<string>("");
  const [searchChild, setSearchChild] = useState<string>("");
  const [searchStaff, setSearchStaff] = useState<string>("");
  const [timeOfDay, setTimeOfDay] = useState<string>("all");
  const [homeAway, setHomeAway] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"date" | "division" | "source">("date");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [calendarView, setCalendarView] = useState<View>('month');
  const [currentDate, setCurrentDate] = useState(new Date());
  const { toast } = useToast();

  useEffect(() => {
    fetchAllEvents();
    fetchDivisions();
    fetchChildren();
    fetchStaff();

    // Set up real-time subscriptions for all tables
    const channel = supabase
      .channel('master-calendar-all-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_calendar' }, () => fetchAllEvents())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities_field_trips' }, () => fetchAllEvents())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'special_events_activities' }, () => fetchAllEvents())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'master_calendar' }, () => fetchAllEvents())
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchAllEvents = async () => {
    setLoading(true);
    try {
      // Fetch all events in parallel
      const [sportsData, fieldTripsData, specialEventsData, masterCalData] = await Promise.all([
        supabase.from("sports_calendar").select(`*, division:divisions(id, name, gender), sports_calendar_divisions(division_id, division:divisions(id, name, gender))`).order("event_date", { ascending: true }),
        supabase.from("activities_field_trips").select(`*, division:divisions(id, name, gender)`).order("event_date", { ascending: true }),
        supabase.from("special_events_activities").select(`*, division:divisions(id, name, gender)`).order("event_date", { ascending: true }),
        supabase.from("master_calendar").select(`*, division:divisions(id, name, gender)`).order("event_date", { ascending: true })
      ]);

      // Normalize all events to unified format
      const unifiedEvents: UnifiedEvent[] = [];

      // Sports Calendar events
      if (sportsData.data) {
        sportsData.data.forEach((event: any) => {
          const divisions = event.sports_calendar_divisions?.map((d: any) => d.division) || (event.division ? [event.division] : []);
          unifiedEvents.push({
            id: `sports_${event.id}`,
            title: event.title,
            event_date: event.event_date,
            time: event.time,
            location: event.location,
            description: event.description,
            source: 'sports_calendar',
            type: event.sport_type || 'Sports Event',
            division: divisions[0],
            originalData: { ...event, divisions }
          });
        });
      }

      // Field Trips events
      if (fieldTripsData.data) {
        fieldTripsData.data.forEach((event: any) => {
          unifiedEvents.push({
            id: `fieldtrip_${event.id}`,
            title: event.title,
            event_date: event.event_date,
            time: event.time,
            location: event.location,
            description: event.description,
            source: 'activities_field_trips',
            type: event.activity_type || 'Field Trip',
            division: event.division,
            originalData: event
          });
        });
      }

      // Special Events events
      if (specialEventsData.data) {
        specialEventsData.data.forEach((event: any) => {
          unifiedEvents.push({
            id: `special_${event.id}`,
            title: event.title,
            event_date: event.event_date,
            time: event.time_slot,
            location: event.location,
            description: event.description,
            source: 'special_events_activities',
            type: event.event_type || 'Special Event',
            division: event.division,
            originalData: event
          });
        });
      }

      // Master Calendar events
      if (masterCalData.data) {
        masterCalData.data.forEach((event: any) => {
          unifiedEvents.push({
            id: `master_${event.id}`,
            title: event.title,
            event_date: event.event_date,
            time: event.time,
            location: event.location,
            description: event.description,
            source: 'master_calendar',
            type: event.type || 'Event',
            division: event.division,
            originalData: event
          });
        });
      }

      setEvents(unifiedEvents);
    } catch (error) {
      console.error("Error fetching events:", error);
      toast({ title: "Error fetching events", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchDivisions = async () => {
    const { data } = await supabase.from("divisions").select("*").order("sort_order");
    if (data) setDivisions(data);
  };

  const fetchChildren = async () => {
    const { data } = await supabase.from("children").select("id, name").eq("status", "active").order("name");
    if (data) setChildren(data);
  };

  const fetchStaff = async () => {
    const { data } = await supabase.from("staff").select("id, name").eq("status", "active").order("name");
    if (data) setStaff(data);
  };

  const filterByChildRoster = async (childId: string) => {
    if (!childId) return true;
    
    // Check sports_event_roster
    const { data: sportsRoster } = await supabase
      .from("sports_event_roster")
      .select("event_id")
      .eq("child_id", childId);
    
    // Check trip_attendees
    const { data: tripAttendees } = await supabase
      .from("trip_attendees")
      .select("trip_id")
      .eq("child_id", childId);
    
    return { sportsRoster: sportsRoster || [], tripAttendees: tripAttendees || [] };
  };

  const filterByStaffRoster = async (staffId: string) => {
    if (!staffId) return true;
    
    // Check sports_event_staff
    const { data: sportsStaff } = await supabase
      .from("sports_event_staff")
      .select("event_id")
      .eq("staff_id", staffId);
    
    return { sportsStaff: sportsStaff || [] };
  };

  const getTimeOfDayFromTime = (timeStr?: string) => {
    if (!timeStr) return "unknown";
    const hour = parseInt(timeStr.split(':')[0]);
    if (hour >= 6 && hour < 12) return "morning";
    if (hour >= 12 && hour < 17) return "afternoon";
    if (hour >= 17 && hour < 21) return "evening";
    return "night";
  };

  const filteredAndSortedEvents = events
    .filter(event => {
      // Division filter
      if (selectedDivision !== "all" && event.division?.id !== selectedDivision) return false;
      
      // Name search
      if (searchName && !event.title.toLowerCase().includes(searchName.toLowerCase())) return false;
      
      // Location search
      if (searchLocation && (!event.location || !event.location.toLowerCase().includes(searchLocation.toLowerCase()))) return false;
      
      // Time of day filter
      if (timeOfDay !== "all") {
        const eventTimeOfDay = getTimeOfDayFromTime(event.time);
        if (eventTimeOfDay !== timeOfDay) return false;
      }
      
      // Home/Away filter (sports events only)
      if (homeAway !== "all" && event.source === 'sports_calendar') {
        if (event.originalData.home_away !== homeAway) return false;
      }
      
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "division") {
        const divA = a.division?.sort_order || 999;
        const divB = b.division?.sort_order || 999;
        if (divA !== divB) return divA - divB;
      } else if (sortBy === "source") {
        return a.source.localeCompare(b.source);
      }
      
      // Default: sort by date
      const dateCompare = new Date(a.event_date).getTime() - new Date(b.event_date).getTime();
      if (dateCompare !== 0) return dateCompare;
      
      // If same date, sort by time
      if (a.time && b.time) {
        return a.time.localeCompare(b.time);
      }
      return a.time ? -1 : b.time ? 1 : 0;
    });

  const groupedEvents: Record<string, UnifiedEvent[]> = filteredAndSortedEvents.reduce((acc, event) => {
    const date = new Date(event.event_date).toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    if (!acc[date]) acc[date] = [];
    acc[date].push(event);
    return acc;
  }, {} as Record<string, UnifiedEvent[]>);

  const activeFilterCount = (selectedDivision !== "all" ? 1 : 0) + 
    (searchName ? 1 : 0) + 
    (searchLocation ? 1 : 0) + 
    (searchChild ? 1 : 0) + 
    (searchStaff ? 1 : 0) + 
    (timeOfDay !== "all" ? 1 : 0) + 
    (homeAway !== "all" ? 1 : 0);

  const clearAllFilters = () => {
    setSelectedDivision("all");
    setSearchName("");
    setSearchLocation("");
    setSearchChild("");
    setSearchStaff("");
    setTimeOfDay("all");
    setHomeAway("all");
  };

  const getSourceIcon = (source: EventSource) => {
    switch (source) {
      case 'sports_calendar': return <Trophy className="h-4 w-4" />;
      case 'activities_field_trips': return <Users className="h-4 w-4" />;
      case 'special_events_activities': return <Sparkles className="h-4 w-4" />;
      case 'master_calendar': return <CalendarIcon className="h-4 w-4" />;
    }
  };

  const getSourceColor = (source: EventSource) => {
    switch (source) {
      case 'sports_calendar': return "bg-blue-500/20 text-blue-700 border-blue-500/30";
      case 'activities_field_trips': return "bg-green-500/20 text-green-700 border-green-500/30";
      case 'special_events_activities': return "bg-purple-500/20 text-purple-700 border-purple-500/30";
      case 'master_calendar': return "bg-orange-500/20 text-orange-700 border-orange-500/30";
    }
  };

  const getSourceLabel = (source: EventSource) => {
    switch (source) {
      case 'sports_calendar': return "Sports";
      case 'activities_field_trips': return "Field Trip";
      case 'special_events_activities': return "Special Event";
      case 'master_calendar': return "General";
    }
  };

  const eventPropGetter = (event: any) => {
    const source = event.resource.source;
    const colors: Record<EventSource, string> = {
      'sports_calendar': '#3b82f6',
      'activities_field_trips': '#22c55e',
      'special_events_activities': '#a855f7',
      'master_calendar': '#f97316'
    };
    
    return {
      style: {
        backgroundColor: colors[source],
        color: 'white',
        borderRadius: '4px',
        padding: '2px 5px',
      }
    };
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold mb-2">Master Calendar</h1>
          <p className="text-muted-foreground">Consolidated view of all camp events and activities</p>
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
        </div>
      </div>

      {/* Advanced Filter Bar */}
      <Card>
        <CardContent className="p-4">
          <div className="space-y-3">
            <div className="flex flex-wrap gap-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search by event name..." 
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Input 
                placeholder="Search by location..." 
                value={searchLocation}
                onChange={(e) => setSearchLocation(e.target.value)}
                className="w-[200px]"
              />

              <Select value={selectedDivision} onValueChange={setSelectedDivision}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Division" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Divisions</SelectItem>
                  {divisions.map((div) => (
                    <SelectItem key={div.id} value={div.id}>
                      {div.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={timeOfDay} onValueChange={setTimeOfDay}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Times</SelectItem>
                  <SelectItem value="morning">Morning</SelectItem>
                  <SelectItem value="afternoon">Afternoon</SelectItem>
                  <SelectItem value="evening">Evening</SelectItem>
                  <SelectItem value="night">Night</SelectItem>
                </SelectContent>
              </Select>

              <Select value={homeAway} onValueChange={setHomeAway}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Home & Away</SelectItem>
                  <SelectItem value="home">Home</SelectItem>
                  <SelectItem value="away">Away</SelectItem>
                  <SelectItem value="neutral">Neutral</SelectItem>
                </SelectContent>
              </Select>

              <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Sort by Date</SelectItem>
                  <SelectItem value="division">Sort by Division</SelectItem>
                  <SelectItem value="source">Sort by Source</SelectItem>
                </SelectContent>
              </Select>

              {activeFilterCount > 0 && (
                <Button variant="ghost" onClick={clearAllFilters}>
                  <X className="h-4 w-4 mr-2" />
                  Clear ({activeFilterCount})
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-muted-foreground">Loading...</p>
      ) : filteredAndSortedEvents.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center">No events match your filters</p>
          </CardContent>
        </Card>
      ) : viewMode === "calendar" ? (
        <Card>
          <CardContent className="p-6">
            <Calendar
              localizer={localizer}
              events={filteredAndSortedEvents.map(event => ({
                id: event.id,
                title: event.title,
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
              eventPropGetter={eventPropGetter}
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
                            {getSourceIcon(event.source)}
                            {event.title}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                          </p>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      <div className="flex gap-2 flex-wrap">
                        <Badge className={getSourceColor(event.source)}>
                          {getSourceLabel(event.source)}
                        </Badge>
                        <Badge variant="outline">{event.type}</Badge>
                        {event.division && (
                          <Badge variant="secondary">{event.division.name}</Badge>
                        )}
                      </div>
                      {event.time && (
                        <p className="text-sm text-muted-foreground">
                          ⏰ {formatTime12Hour(event.time)}
                        </p>
                      )}
                      {event.location && (
                        <p className="text-sm text-muted-foreground">📍 {event.location}</p>
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
    </div>
  );
}