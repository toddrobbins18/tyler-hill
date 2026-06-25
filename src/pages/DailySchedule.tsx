import { useState, useEffect, useMemo } from "react";
import { sortDivisionsAlternatingGender } from "@/lib/divisionUtils";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CalendarIcon, Clock, MapPin, Users, ChevronLeft, ChevronRight, Filter, Loader2, FileText, Camera, Shirt, Phone, Globe, CalendarOff } from "lucide-react";
import { cn, formatTime12Hour } from "@/lib/utils";
import { useTigerTimesColors } from "@/hooks/useTigerTimesColors";
import DivisionScheduleUploader from "@/components/admin/DivisionScheduleUploader";
import { useSeasonContext } from "@/contexts/SeasonContext";

interface Division {
  id: string;
  name: string;
  gender: string;
}

interface ScheduleEvent {
  id: string;
  title: string;
  type: string;
  time: string | null;
  location: string | null;
  description: string | null;
  source: 'sports' | 'activities' | 'special_events' | 'master_calendar';
  divisions: string[];
}

export default function DailySchedule() {
  const { currentCompany } = useCompany();
  const { selectedSeason } = useSeason();
  const { getDivisionFilter, userRole, isSuperAdmin } = usePermissions();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDivision, setSelectedDivision] = useState<string>("all");
  const [divisions, setDivisions] = useState<Division[]>([]);
  const [events, setEvents] = useState<ScheduleEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingEvents, setLoadingEvents] = useState(false);
  const { currentSeason } = useSeasonContext();

  // Tiger Times content for Timber Lake Camp
  const [tigerTimesContent, setTigerTimesContent] = useState<any>(null);
  const isTimberLakeCamp = currentCompany?.slug === 'timber-lake-camp';
  const ttColors = useTigerTimesColors();

  const fetchTigerTimesContent = async () => {
    if (!currentCompany || !isTimberLakeCamp) return;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const { data } = await supabase
      .from('daily_wolf_content')
      .select('*')
      .eq('company_id', currentCompany.id)
      .eq('date', dateStr)
      .eq('season', currentSeason)
      .maybeSingle();
    setTigerTimesContent(data);
  };

  // Get user's accessible divisions
  const divisionFilter = getDivisionFilter();
  const hasDivisionRestriction = divisionFilter !== null && divisionFilter.length > 0;

  // Filter divisions based on user access
  const accessibleDivisions = useMemo(() => {
    if (!hasDivisionRestriction) return divisions;
    return divisions.filter(d => divisionFilter.includes(d.id));
  }, [divisions, divisionFilter, hasDivisionRestriction]);

  useEffect(() => {
    if (currentCompany?.id) {
      fetchDivisions();
    }
  }, [currentCompany?.id]);

  useEffect(() => {
    if (currentCompany?.id) {
      fetchScheduleEvents();
      if (isTimberLakeCamp) fetchTigerTimesContent();
    }
  }, [currentCompany?.id, selectedDate, selectedSeason]);

  const fetchDivisions = async () => {
    if (!currentCompany?.id) return;

    const { data, error } = await supabase
      .from("divisions")
      .select("*")
      .eq("company_id", currentCompany.id)
      .eq("is_active", true)
      .order("sort_order");

    if (error) {
      console.error("Error fetching divisions:", error);
      toast({ title: "Error loading divisions", variant: "destructive" });
    } else {
      setDivisions(sortDivisionsAlternatingGender(data || []));
      
      // Auto-select first accessible division for restricted users
      if (divisionFilter && divisionFilter.length > 0 && data) {
        const firstAccessible = data.find(d => divisionFilter.includes(d.id));
        if (firstAccessible) {
          setSelectedDivision(firstAccessible.id);
        }
      }
    }
    setLoading(false);
  };

  const fetchScheduleEvents = async () => {
    if (!currentCompany?.id) return;

    setLoadingEvents(true);
    const dateStr = format(selectedDate, "yyyy-MM-dd");
    const allEvents: ScheduleEvent[] = [];

    try {
      // Fetch from multiple sources in parallel
      const [sportsRes, activitiesRes, specialEventsRes, masterCalendarRes] = await Promise.all([
        // Sports Calendar events
        supabase
          .from("sports_calendar")
          .select(`
            id, title, sport_type, opponent, event_date, time, start_time_field, depart_time, location, description, home_away,
            sports_calendar_divisions(division_id)
          `)
          .eq("company_id", currentCompany.id)
          .eq("season", selectedSeason)
          .eq("event_date", dateStr),

        // Activities & Field Trips
        supabase
          .from("activities_field_trips")
          .select(`
            id, title, activity_type, event_date, time, location, description,
            activities_field_trips_divisions(division_id)
          `)
          .eq("company_id", currentCompany.id)
          .eq("season", selectedSeason)
          .eq("event_date", dateStr),

        // Special Events
        supabase
          .from("special_events_activities")
          .select("id, title, event_type, event_date, start_time, end_time, time_slot, location, description, division_id")
          .eq("company_id", currentCompany.id)
          .eq("season", selectedSeason)
          .eq("event_date", dateStr),

        // Master Calendar
        supabase
          .from("master_calendar")
          .select("id, title, type, event_date, time, location, description, division_id")
          .eq("company_id", currentCompany.id)
          .eq("season", selectedSeason)
          .eq("event_date", dateStr)
      ]);

      // Process Sports Calendar
      if (sportsRes.data) {
        for (const event of sportsRes.data) {
          const divisionIds = ((event as any).sports_calendar_divisions || []).map((d: any) => d.division_id);
          allEvents.push({
            id: event.id,
            title: event.title || `${event.sport_type}${event.opponent ? ` vs ${event.opponent}` : ''}`,
            type: event.home_away === 'home' ? 'Home Game' : event.home_away === 'away' ? 'Away Game' : 'Sports',
            time: formatTime12Hour(event.start_time_field || event.time || event.depart_time) || event.start_time_field || event.time || event.depart_time || null,
            location: event.location,
            description: event.description,
            source: 'sports',
            divisions: divisionIds
          });
        }
      }

      // Process Activities & Field Trips
      if (activitiesRes.data) {
        for (const event of activitiesRes.data) {
          const divisionIds = ((event as any).activities_field_trips_divisions || []).map((d: any) => d.division_id);
          allEvents.push({
            id: event.id,
            title: event.title,
            type: event.activity_type,
            time: event.time,
            location: event.location,
            description: event.description,
            source: 'activities',
            divisions: divisionIds
          });
        }
      }

      // Process Special Events
      if (specialEventsRes.data) {
        for (const event of specialEventsRes.data) {
          allEvents.push({
            id: event.id,
            title: event.title,
            type: event.event_type || 'Special Event',
            time: event.start_time || event.time_slot,
            location: event.location,
            description: event.description,
            source: 'special_events',
            divisions: event.division_id ? [event.division_id] : []
          });
        }
      }

      // Process Master Calendar
      if (masterCalendarRes.data) {
        for (const event of masterCalendarRes.data) {
          allEvents.push({
            id: event.id,
            title: event.title,
            type: event.type,
            time: event.time,
            location: event.location,
            description: event.description,
            source: 'master_calendar',
            divisions: event.division_id ? [event.division_id] : []
          });
        }
      }

      // Sort by time
      allEvents.sort((a, b) => {
        if (!a.time && !b.time) return 0;
        if (!a.time) return 1;
        if (!b.time) return -1;
        return a.time.localeCompare(b.time);
      });

      setEvents(allEvents);
    } catch (error) {
      console.error("Error fetching schedule events:", error);
      toast({ title: "Error loading schedule", variant: "destructive" });
    } finally {
      setLoadingEvents(false);
    }
  };

  // Filter events based on selected division
  const filteredEvents = useMemo(() => {
    let filtered = events;

    // Apply division filter
    if (selectedDivision !== "all") {
      filtered = filtered.filter(event => 
        event.divisions.length === 0 || event.divisions.includes(selectedDivision)
      );
    }

    // Apply user division restrictions
    if (hasDivisionRestriction) {
      filtered = filtered.filter(event =>
        event.divisions.length === 0 || event.divisions.some(d => divisionFilter.includes(d))
      );
    }

    return filtered;
  }, [events, selectedDivision, hasDivisionRestriction, divisionFilter]);

  const navigateDate = (direction: 'prev' | 'next') => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + (direction === 'next' ? 1 : -1));
    setSelectedDate(newDate);
  };

  const getSourceBadgeColor = (source: ScheduleEvent['source']) => {
    switch (source) {
      case 'sports':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300';
      case 'activities':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300';
      case 'special_events':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300';
      case 'master_calendar':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300';
      default:
        return '';
    }
  };

  const getSourceLabel = (source: ScheduleEvent['source']) => {
    switch (source) {
      case 'sports': return 'Sports';
      case 'activities': return 'Activity';
      case 'special_events': return 'Event';
      case 'master_calendar': return 'Calendar';
      default: return source;
    }
  };

  const getDivisionNames = (divisionIds: string[]) => {
    if (divisionIds.length === 0) return 'All Divisions';
    return divisionIds
      .map(id => divisions.find(d => d.id === id)?.name || 'Unknown')
      .join(', ');
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold">Daily Schedule</h1>
          <p className="text-muted-foreground">View the day's schedule by division</p>
        </div>
      </div>

      <Tabs defaultValue="schedule" className="w-full">
        <TabsList>
          <TabsTrigger value="schedule" className="flex items-center gap-2">
            <CalendarIcon className="h-4 w-4" />
            Schedule View
          </TabsTrigger>
          <TabsTrigger value="uploads" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Upload Schedules
          </TabsTrigger>
        </TabsList>

        <TabsContent value="schedule" className="space-y-6 mt-6">
          {/* Controls */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                {/* Date Navigation */}
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" onClick={() => navigateDate('prev')}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className="w-[200px] justify-start text-left font-normal">
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {format(selectedDate, "EEEE, MMM d, yyyy")}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={selectedDate}
                        onSelect={(date) => date && setSelectedDate(date)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>

                  <Button variant="outline" size="icon" onClick={() => navigateDate('next')}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>

                  <Button variant="ghost" size="sm" onClick={() => setSelectedDate(new Date())}>
                    Today
                  </Button>
                </div>

                {/* Division Filter */}
                <div className="flex items-center gap-2">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <Select value={selectedDivision} onValueChange={setSelectedDivision}>
                    <SelectTrigger className="w-[200px]">
                      <SelectValue placeholder="Filter by division" />
                    </SelectTrigger>
                    <SelectContent>
                      {!hasDivisionRestriction && (
                        <SelectItem value="all">All Divisions</SelectItem>
                      )}
                      {accessibleDivisions.map((division) => (
                        <SelectItem key={division.id} value={division.id}>
                          {division.name} ({division.gender === 'male' ? 'Boys' : 'Girls'})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Tiger Times Cards */}
          {isTimberLakeCamp && tigerTimesContent && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <Card style={{ borderTopWidth: '3px', borderTopColor: ttColors["Laundry"] }}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: ttColors["Laundry"] + '1a' }}>
                      <Shirt className="h-4 w-4" style={{ color: ttColors["Laundry"] }} />
                    </div>
                    <CardTitle className="text-base">👕 Laundry</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {tigerTimesContent.laundry_info || 'No info'}
                  </p>
                </CardContent>
              </Card>

              <Card style={{ borderTopWidth: '3px', borderTopColor: ttColors["Phone Calls"] }}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: ttColors["Phone Calls"] + '1a' }}>
                      <Phone className="h-4 w-4" style={{ color: ttColors["Phone Calls"] }} />
                    </div>
                    <CardTitle className="text-base">📞 Phone Calls</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {tigerTimesContent.phone_calls_info || 'No info'}
                  </p>
                </CardContent>
              </Card>

              <Card style={{ borderTopWidth: '3px', borderTopColor: ttColors["Outside Events"] }}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: ttColors["Outside Events"] + '1a' }}>
                      <Globe className="h-4 w-4" style={{ color: ttColors["Outside Events"] }} />
                    </div>
                    <CardTitle className="text-base">🌐 Outside Events</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {tigerTimesContent.outside_event || 'No info'}
                  </p>
                </CardContent>
              </Card>

              <Card style={{ borderTopWidth: '3px', borderTopColor: ttColors["Staff Days Off"] }}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: ttColors["Staff Days Off"] + '1a' }}>
                      <CalendarOff className="h-4 w-4" style={{ color: ttColors["Staff Days Off"] }} />
                    </div>
                    <CardTitle className="text-base">🗓️ Staff Days Off</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {tigerTimesContent.staff_days_off || 'No info'}
                  </p>
                </CardContent>
              </Card>

              <Card style={{ borderTopWidth: '3px', borderTopColor: ttColors["OD Notes"] }}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg" style={{ backgroundColor: ttColors["OD Notes"] + '1a' }}>
                      <FileText className="h-4 w-4" style={{ color: ttColors["OD Notes"] }} />
                    </div>
                    <CardTitle className="text-base">💗 OD Notes</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {tigerTimesContent.od_notes || 'No info'}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Schedule Table */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CalendarIcon className="h-5 w-5" />
                Schedule for {format(selectedDate, "EEEE, MMMM d, yyyy")}
              </CardTitle>
              <CardDescription>
                {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} scheduled
                {selectedDivision !== 'all' && accessibleDivisions.find(d => d.id === selectedDivision) && (
                  <> for {accessibleDivisions.find(d => d.id === selectedDivision)?.name}</>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingEvents ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : filteredEvents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium">No events scheduled</p>
                  <p className="text-sm">There are no events for this date and division.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Time</TableHead>
                      <TableHead>Event</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Divisions</TableHead>
                      <TableHead>Source</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEvents.map((event) => (
                      <TableRow key={`${event.source}-${event.id}`}>
                        <TableCell className="font-medium">
                          {event.time ? (
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              {event.time}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">All Day</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{event.title}</p>
                            {event.description && (
                              <p className="text-sm text-muted-foreground line-clamp-1">
                                {event.description}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">{event.type}</Badge>
                        </TableCell>
                        <TableCell>
                          {event.location ? (
                            <div className="flex items-center gap-1">
                              <MapPin className="h-3 w-3 text-muted-foreground" />
                              {event.location}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Users className="h-3 w-3 text-muted-foreground" />
                            <span className="text-sm">{getDivisionNames(event.divisions)}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-xs", getSourceBadgeColor(event.source))}>
                            {getSourceLabel(event.source)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="uploads" className="mt-6">
          <DivisionScheduleUploader />
        </TabsContent>
      </Tabs>
    </div>
  );
}
