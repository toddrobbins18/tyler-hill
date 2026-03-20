import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { Calendar as CalendarIcon, Plus, List, Pencil, Trash2, Search, X, Trophy, Users, Star, Sparkles, MapPin, Clock, Home, Plane, FileText, Download } from "lucide-react";
import { CalendarColorSettings } from "@/components/CalendarColorSettings";
import { CalendarZoomWrapper } from "@/components/CalendarZoomWrapper";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CSVUploader } from "@/components/CSVUploader";
import { Calendar, dateFnsLocalizer, View } from 'react-big-calendar';
import { format, parse, startOfWeek, getDay, addDays, eachDayOfInterval, isValid } from 'date-fns';
import { enUS } from 'date-fns/locale';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { formatTime12Hour } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCompany } from "@/contexts/CompanyContext";
import { sortDivisionsGirlsFirst } from "@/lib/divisionUtils";
import { usePermissions } from "@/hooks/usePermissions";

const locales = { 'en-US': enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

type EventSource = 'sports_calendar' | 'activities_field_trips' | 'special_events_activities' | 'tiger_times';

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
  const { currentSeason } = useSeasonContext();
  const { currentCompany } = useCompany();
  const { getDivisionFilter } = usePermissions();
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
  const [selectedEvent, setSelectedEvent] = useState<UnifiedEvent | null>(null);
  const { toast } = useToast();
  const [customColors, setCustomColors] = useState<Record<string, string>>({});

  const masterCalendarDefaultColors: Record<string, string> = {
    "Sports (Default)": "#3b82f6",
    "Field Trip (Default)": "#22c55e",
    "Special Event (Default)": "#a855f7",
    "Teen Trip": "#6b7280",
    "Collegiate Trip": "#14b8a6",
    "Senior Trip": "#7f1d1d",
    "Junior Trip": "#9333ea",
    "Olympics": "#000000",
    "Wacky Wednesday": "#000000",
    "Divisional Night": "#bf00ff",
    "Campus Night": "#4d4dff",
    "Full Camp": "#ff6600",
    "Rookie Day": "#22c55e",
    "Tour": "#000000",
    "Away (Sports)": "#1e3a5f",
    "Home (Sports)": "#166534",
    "Gordon": "#39ff14",
    "Jacobs": "#39ff14",
    "Bocian/Melter Bowl": "#39ff14",
    "Tiger Times (Default)": "#f59e0b",
    "TT: Laundry": "#3b82f6",
    "TT: Phone Calls": "#ef4444",
    "TT: Outside Events": "#eab308",
    "TT: Staff Days Off": "#93c5fd",
    "TT: OD Notes": "#ec4899",
  };

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
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentSeason]);

  const fetchAllEvents = async () => {
    setLoading(true);
    try {
      if (!currentCompany?.id) {
        setEvents([]);
        setLoading(false);
        return;
      }

      // Fetch all events in parallel with batch fetching - filtered by company
      const [sportsBatch1, sportsBatch2, fieldTripsBatch1, fieldTripsBatch2, specialBatch1, specialBatch2] = await Promise.all([
        supabase.from("sports_calendar").select(`*, division:divisions(id, name, gender), sports_calendar_divisions(division_id, division:divisions(id, name, gender))`).eq('company_id', currentCompany.id).order("event_date", { ascending: true }).range(0, 999),
        supabase.from("sports_calendar").select(`*, division:divisions(id, name, gender), sports_calendar_divisions(division_id, division:divisions(id, name, gender))`).eq('company_id', currentCompany.id).order("event_date", { ascending: true }).range(1000, 1999),
        supabase.from("activities_field_trips").select(`*, division:divisions(id, name, gender)`).eq('company_id', currentCompany.id).order("event_date", { ascending: true }).range(0, 999),
        supabase.from("activities_field_trips").select(`*, division:divisions(id, name, gender)`).eq('company_id', currentCompany.id).order("event_date", { ascending: true }).range(1000, 1999),
        supabase.from("special_events_activities").select(`*, division:divisions(id, name, gender)`).eq('company_id', currentCompany.id).order("event_date", { ascending: true }).range(0, 999),
        supabase.from("special_events_activities").select(`*, division:divisions(id, name, gender)`).eq('company_id', currentCompany.id).order("event_date", { ascending: true }).range(1000, 1999)
      ]);

      // Combine batches
      const sportsData = { data: [...(sportsBatch1.data || []), ...(sportsBatch2.data || [])] };
      const fieldTripsData = { data: [...(fieldTripsBatch1.data || []), ...(fieldTripsBatch2.data || [])] };
      const specialEventsData = { data: [...(specialBatch1.data || []), ...(specialBatch2.data || [])] };

      // Filter by season
      const sportsFiltered = sportsData.data.filter((e: any) => e.season === currentSeason || e.season === null);
      const fieldTripsFiltered = fieldTripsData.data.filter((e: any) => e.season === currentSeason || e.season === null);
      const specialEventsFiltered = specialEventsData.data.filter((e: any) => e.season === currentSeason || e.season === null);

      // Normalize all events to unified format
      const unifiedEvents: UnifiedEvent[] = [];

      // Sports Calendar events
      if (sportsFiltered) {
        sportsFiltered.forEach((event: any) => {
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
      if (fieldTripsFiltered) {
        fieldTripsFiltered.forEach((event: any) => {
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
      if (specialEventsFiltered) {
        specialEventsFiltered.forEach((event: any) => {
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

      // Filter events by user's accessible divisions
      let filteredUnifiedEvents = unifiedEvents;
      const divisionFilter = getDivisionFilter();
      if (divisionFilter !== null && divisionFilter.length > 0) {
        filteredUnifiedEvents = unifiedEvents.filter(event => {
          // Check if the event's division matches user's accessible divisions
          const eventDivisionId = event.division?.id;
          const eventDivisions = event.originalData?.divisions?.map((d: any) => d.id) || 
                                 event.originalData?.sports_calendar_divisions?.map((d: any) => d.division_id) || [];
          if (eventDivisionId) eventDivisions.push(eventDivisionId);
          return eventDivisions.some((divId: string) => divisionFilter.includes(divId)) || eventDivisions.length === 0;
        });
      }

      setEvents(filteredUnifiedEvents);
    } catch (error) {
      console.error("Error fetching events:", error);
      toast({ title: "Error fetching events", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const fetchDivisions = async () => {
    if (!currentCompany?.id) {
      setDivisions([]);
      return;
    }
    const { data } = await supabase.from("divisions").select("*").eq('company_id', currentCompany.id).eq('is_active', true);
    if (data) setDivisions(sortDivisionsGirlsFirst(data));
  };

  const fetchChildren = async () => {
    if (!currentCompany?.id) {
      setChildren([]);
      return;
    }
    const { data } = await supabase.from("children").select("id, name").eq("status", "active").eq('company_id', currentCompany.id).eq("season", currentSeason).order("name");
    if (data) setChildren(data);
  };

  const fetchStaff = async () => {
    if (!currentCompany?.id) {
      setStaff([]);
      return;
    }
    const { data } = await supabase.from("staff").select("id, name").eq("status", "active").eq('company_id', currentCompany.id).eq("season", currentSeason).order("name");
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

  const getNormalizedEventTime = (event: UnifiedEvent): string | null => {
    const rawTime = event.originalData?.start_time_field || event.originalData?.start_time || event.time || event.originalData?.depart_time;
    if (!rawTime || typeof rawTime !== "string") return null;

    const trimmedTime = rawTime.trim();
    if (!trimmedTime) return null;

    // Handle ranges like "9:30 AM - 10:30 AM" by using the start portion
    const startPortion = trimmedTime.split("-")[0]?.trim() || trimmedTime;

    // 24-hour with seconds (e.g. 09:30:00)
    if (/^\d{1,2}:\d{2}:\d{2}$/.test(startPortion)) {
      return startPortion.slice(0, 5).padStart(5, "0");
    }

    // 24-hour (e.g. 9:05, 14:30)
    if (/^\d{1,2}:\d{2}$/.test(startPortion)) {
      return startPortion.padStart(5, "0");
    }

    // 12-hour time with AM/PM (e.g. 9:05 AM, 12 PM)
    const parsed12Hour = parse(startPortion, "h:mm a", new Date());
    if (isValid(parsed12Hour)) {
      return format(parsed12Hour, "HH:mm");
    }

    const parsedHourOnly = parse(startPortion, "h a", new Date());
    if (isValid(parsedHourOnly)) {
      return format(parsedHourOnly, "HH:mm");
    }

    return null;
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
        const divA = a.division;
        const divB = b.division;
        
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
      } else if (sortBy === "source") {
        return a.source.localeCompare(b.source);
      }
      
      // Default: sort by date
      const dateCompare = new Date(a.event_date + 'T00:00:00').getTime() - new Date(b.event_date + 'T00:00:00').getTime();
      if (dateCompare !== 0) return dateCompare;
      
      // If same date, sort by normalized time
      const timeA = getNormalizedEventTime(a);
      const timeB = getNormalizedEventTime(b);
      if (timeA && timeB) return timeA.localeCompare(timeB);
      if (timeA) return -1;
      if (timeB) return 1;
      return 0;
    });

  const groupedEvents: Record<string, UnifiedEvent[]> = filteredAndSortedEvents.reduce((acc, event) => {
    const date = new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
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
    }
  };

  const getSourceColor = (source: EventSource) => {
    switch (source) {
      case 'sports_calendar': return "bg-blue-500/20 text-blue-700 border-blue-500/30";
      case 'activities_field_trips': return "bg-green-500/20 text-green-700 border-green-500/30";
      case 'special_events_activities': return "bg-purple-500/20 text-purple-700 border-purple-500/30";
    }
  };

  const getSubCategoryColor = (eventType: string, subCategory: string): string | undefined => {
    const colorMap: Record<string, Record<string, string>> = {
      "field-trip": { "Teen Trip": "bg-gray-500 text-white", "Collegiate Trip": "bg-teal-500 text-white", "Senior Trip": "bg-red-900 text-white", "Junior Trip": "bg-purple-600 text-white" },
    };
    return colorMap[eventType]?.[subCategory];
  };

  const getSourceLabel = (source: EventSource) => {
    switch (source) {
      case 'sports_calendar': return "Sports";
      case 'activities_field_trips': return "Field Trip";
      case 'special_events_activities': return "Special Event";
    }
  };

  const eventPropGetter = (event: any) => {
    const source = event.resource.source;
    const subCategory = event.resource.originalData?.sub_category;
    const eventType = event.resource.originalData?.event_type || event.resource.originalData?.activity_type;
    const homeAway = event.resource.originalData?.home_away;

    // Trip colors - use customColors (which includes user overrides)
    const cc = customColors;

    let bgColor: string | undefined;
    if (subCategory && cc[subCategory]) bgColor = cc[subCategory];
    if (!bgColor && eventType && cc[eventType]) bgColor = cc[eventType];
    // Sports calendar home/away and Gordon/Jacobs/Bocian colors
    if (source === 'sports_calendar' && (homeAway === 'away' || event.resource.originalData?.event_type === 'Away')) bgColor = cc["Away (Sports)"] || '#1e3a5f';
    if (source === 'sports_calendar' && (homeAway === 'home' || event.resource.originalData?.event_type === 'Home')) bgColor = cc["Home (Sports)"] || '#166534';
    if (source === 'sports_calendar' && ['Gordon', 'Jacobs', 'Bocian/Melter Bowl'].includes(event.resource.originalData?.event_type)) bgColor = cc[event.resource.originalData?.event_type] || '#39ff14';

    const sourceColors: Record<EventSource, string> = {
      'sports_calendar': cc["Sports (Default)"] || '#3b82f6',
      'activities_field_trips': cc["Field Trip (Default)"] || '#22c55e',
      'special_events_activities': cc["Special Event (Default)"] || '#a855f7'
    };
    
    const finalBg = bgColor || sourceColors[source];
    const isNeonGreen = finalBg === '#39ff14';
    
    return {
      style: {
        backgroundColor: finalBg,
        color: isNeonGreen ? '#000000' : 'white',
        borderRadius: '4px',
        padding: '2px 5px',
      }
    };
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Master Calendar</h1>
            <p className="text-muted-foreground">Consolidated view of all events and activities for The Nest</p>
          </div>
        </div>
        <div className="flex gap-2">
          <CalendarColorSettings
            calendarId="master-calendar"
            defaultColors={masterCalendarDefaultColors}
            onColorsChange={setCustomColors}
          />
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
            <CalendarZoomWrapper>
              {(height) => (
                <Calendar
                  localizer={localizer}
                  events={filteredAndSortedEvents.map(event => {
                    const isMultiDay = event.source === 'activities_field_trips' && 
                      event.originalData.is_multi_day && 
                      event.originalData.end_date;
                    
                    const hasSpecificTime = event.source === 'special_events_activities' && 
                      event.originalData.start_time && 
                      event.originalData.end_time;
                    
                    let startDate: Date;
                    let endDate: Date;
                    let allDay = false;
                    
                    if (hasSpecificTime) {
                      const normStart = getNormalizedEventTime({ ...event, time: event.originalData.start_time, originalData: { ...event.originalData, start_time_field: event.originalData.start_time } });
                      const normEnd = getNormalizedEventTime({ ...event, time: event.originalData.end_time, originalData: { ...event.originalData, start_time_field: event.originalData.end_time } });
                      if (normStart && normEnd) {
                        startDate = new Date(event.event_date + 'T' + normStart + ':00');
                        endDate = new Date(event.event_date + 'T' + normEnd + ':00');
                      } else {
                        startDate = new Date(event.event_date + 'T' + event.originalData.start_time);
                        endDate = new Date(event.event_date + 'T' + event.originalData.end_time);
                      }
                    } else if (isMultiDay) {
                      startDate = new Date(event.event_date + 'T00:00:00');
                      endDate = addDays(new Date(event.originalData.end_date + 'T00:00:00'), 1);
                      allDay = true;
                    } else {
                      const normalizedTime = getNormalizedEventTime(event);
                      if (normalizedTime) {
                        startDate = new Date(event.event_date + 'T' + normalizedTime + ':00');
                        endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);
                      } else {
                        startDate = new Date(event.event_date + 'T00:00:00');
                        endDate = new Date(event.event_date + 'T23:59:59');
                        allDay = true;
                      }
                    }
                    
                    return {
                      id: event.id,
                      title: (event.originalData?.emoji ? `${event.originalData.emoji} ` : '') + event.title,
                      start: startDate,
                      end: endDate,
                      allDay,
                      resource: event,
                    };
                  })}
                  startAccessor="start"
                  endAccessor="end"
                  style={{ height }}
                  view={calendarView}
                  onView={setCalendarView}
                  date={currentDate}
                  onNavigate={setCurrentDate}
                  onSelectEvent={(event: any) => setSelectedEvent(event.resource)}
                  eventPropGetter={eventPropGetter}
                />
              )}
            </CalendarZoomWrapper>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedEvents).map(([month, monthEvents]) => (
            <div key={month}>
              <h2 className="text-xl font-semibold mb-3">{month}</h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {monthEvents.map((event) => (
                  <Card 
                    key={event.id} 
                    className="hover:shadow-lg transition-shadow cursor-pointer"
                    onClick={() => setSelectedEvent(event)}
                  >
                    <CardHeader>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <CardTitle className="text-lg flex items-center gap-2">
                            {getSourceIcon(event.source)}
                            {event.title}
                          </CardTitle>
                          <p className="text-sm text-muted-foreground mt-1">
                            {new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
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
                        {event.originalData?.sub_category && (
                          <Badge className={getSubCategoryColor(event.originalData?.event_type, event.originalData.sub_category) || ""}>
                            {event.originalData.sub_category}
                          </Badge>
                        )}
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

      {/* Event Detail Dialog */}
      {selectedEvent && (
        <Dialog open={!!selectedEvent} onOpenChange={() => setSelectedEvent(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                {getSourceIcon(selectedEvent.source)}
                {selectedEvent.title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {/* Event Type & Source Badge */}
              <div className="flex gap-2 flex-wrap">
                <Badge className={getSourceColor(selectedEvent.source)}>
                  {getSourceLabel(selectedEvent.source)}
                </Badge>
                <Badge variant="outline">{selectedEvent.type}</Badge>
                {selectedEvent.originalData?.sub_category && (
                  <Badge className={getSubCategoryColor(selectedEvent.originalData?.event_type, selectedEvent.originalData.sub_category) || ""}>
                    {selectedEvent.originalData.sub_category}
                  </Badge>
                )}
              </div>

              {/* Division */}
              {(selectedEvent.division || selectedEvent.originalData?.divisions?.length > 0) && (
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-muted-foreground" />
                  <div className="flex gap-1 flex-wrap">
                    {selectedEvent.originalData?.divisions?.length > 0 ? (
                      selectedEvent.originalData.divisions.map((div: any, idx: number) => (
                        <Badge key={idx} variant="secondary">{div.name}</Badge>
                      ))
                    ) : selectedEvent.division ? (
                      <Badge variant="secondary">{selectedEvent.division.name}</Badge>
                    ) : null}
                  </div>
                </div>
              )}

              {/* Date & Time */}
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {new Date(selectedEvent.event_date + 'T00:00:00').toLocaleDateString('en-US', { 
                    weekday: 'long', 
                    month: 'long', 
                    day: 'numeric', 
                    year: 'numeric' 
                  })}
                </span>
              </div>

              {selectedEvent.time && (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{formatTime12Hour(selectedEvent.time)}</span>
                </div>
              )}

              {/* Location */}
              {selectedEvent.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{selectedEvent.location}</span>
                </div>
              )}

              {/* Home/Away for sports events */}
              {selectedEvent.source === 'sports_calendar' && selectedEvent.originalData?.home_away && (
                <div className="flex items-center gap-2">
                  {selectedEvent.originalData.home_away === 'home' ? (
                    <Home className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Plane className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-sm capitalize">{selectedEvent.originalData.home_away}</span>
                </div>
              )}

              {/* Sports-specific: Team vs Opponent */}
              {selectedEvent.source === 'sports_calendar' && selectedEvent.originalData?.team && selectedEvent.originalData?.opponent && (
                <div className="p-3 bg-muted rounded-lg">
                  <p className="text-sm font-medium">
                    {selectedEvent.originalData.team} vs {selectedEvent.originalData.opponent}
                  </p>
                </div>
              )}

              {/* Depart Time for away events */}
              {selectedEvent.source === 'sports_calendar' && selectedEvent.originalData?.depart_time && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Plane className="h-4 w-4" />
                  <span>Depart: {formatTime12Hour(selectedEvent.originalData.depart_time)}</span>
                </div>
              )}

              {/* Description */}
              {selectedEvent.description && (
                <div className="border-t pt-4">
                  <p className="text-sm text-muted-foreground">{selectedEvent.description}</p>
                </div>
              )}

              {/* File Attachment for Special Events */}
              {selectedEvent.source === 'special_events_activities' && selectedEvent.originalData?.file_url && (
                <div className="border-t pt-4">
                  <a 
                    href={selectedEvent.originalData.file_url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <FileText className="h-4 w-4" />
                    <span>{selectedEvent.originalData.file_name || 'View Attachment'}</span>
                    <Download className="h-3 w-3" />
                  </a>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}