import { useEffect, useMemo, useState } from "react";
import { Calendar, dateFnsLocalizer, View } from "react-big-calendar";
import { format, getDay, parse, startOfWeek } from "date-fns";
import { enUS } from "date-fns/locale";
import {
  Calendar as CalendarIcon,
  LayoutList,
  Search,
  Trophy,
  User,
  X,
} from "lucide-react";
import "react-big-calendar/lib/css/react-big-calendar.css";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarZoomWrapper } from "@/components/CalendarZoomWrapper";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useSpecialistSportScope } from "@/hooks/useSpecialistSportScope";
import { sortDivisionsAlternatingGender } from "@/lib/divisionUtils";
import {
  enrichSportsAcademyEnrollments,
  enrollmentMatchesSpecialistSports,
  expandSportsAcademyCalendarEvents,
  sportsAcademyCalendarRange,
  sportsAcademyCamperName,
  type SportsAcademyCalendarEvent,
  type SportsAcademyEnrollment,
} from "@/lib/sportsAcademyUtils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const locales = { "en-US": enUS };
const localizer = dateFnsLocalizer({ format, parse, startOfWeek, getDay, locales });

const sportColors: Record<string, string> = {
  Baseball: "#3b82f6",
  Basketball: "#f97316",
  Dance: "#ec4899",
  Football: "#22c55e",
  Golf: "#10b981",
  Gymnastics: "#a855f7",
  Hockey: "#06b6d4",
  Lacrosse: "#6366f1",
  Soccer: "#84cc16",
  Softball: "#eab308",
  Tennis: "#14b8a6",
  Volleyball: "#f43f5e",
  Waterfront: "#0ea5e9",
};

export default function SportsAcademyCalendar() {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const { getDivisionFilter, loading: permissionsLoading, userDivisions } = usePermissions();
  const {
    assignedSports,
    hasSportScope,
    isSpecialist,
    getSportFilter,
    loading: sportScopeLoading,
  } = useSpecialistSportScope();
  const { toast } = useToast();

  const [enrollments, setEnrollments] = useState<SportsAcademyEnrollment[]>([]);
  const [divisions, setDivisions] = useState<any[]>([]);
  const [selectedSport, setSelectedSport] = useState<string>("all");
  const [selectedDivision, setSelectedDivision] = useState<string>("all");
  const [selectedGender, setSelectedGender] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"calendar" | "list">("calendar");
  const [calendarView, setCalendarView] = useState<View>("month");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedEvent, setSelectedEvent] = useState<SportsAcademyCalendarEvent | null>(null);

  useEffect(() => {
    if (permissionsLoading || sportScopeLoading) return;
    fetchEnrollments();
    fetchDivisions();

    const channel = supabase
      .channel("sports-academy-calendar-changes")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sports_academy" },
        () => fetchEnrollments(),
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [permissionsLoading, sportScopeLoading, userDivisions, currentCompany?.id, currentSeason]);

  useEffect(() => {
    if (!hasSportScope || assignedSports.length !== 1) return;
    setSelectedSport(assignedSports[0]);
  }, [hasSportScope, assignedSports]);

  const fetchEnrollments = async () => {
    if (!currentCompany?.id) {
      setEnrollments([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("sports_academy")
      .select("*")
      .eq("company_id", currentCompany.id)
      .eq("season", currentSeason)
      .order("sport_name", { ascending: true });

    if (error) {
      toast({ title: "Error fetching enrollments", variant: "destructive" });
      setLoading(false);
      return;
    }

    let rows = (data || []) as SportsAcademyEnrollment[];
    try {
      rows = await enrichSportsAcademyEnrollments(
        supabase,
        rows,
        currentCompany.id,
        currentSeason,
      );
    } catch (enrichError) {
      console.error("[SportsAcademyCalendar] Failed to enrich camper names:", enrichError);
    }

    const sportFilter = getSportFilter();
    if (sportFilter) {
      rows = rows.filter((enrollment) => enrollmentMatchesSpecialistSports(enrollment, sportFilter));
    } else if (isSpecialist && assignedSports.length === 0) {
      rows = [];
    }

    const divisionFilter = getDivisionFilter();
    if (divisionFilter !== null && divisionFilter.length > 0) {
      rows = rows.filter(
        (enrollment) =>
          enrollment.child?.division_id && divisionFilter.includes(enrollment.child.division_id),
      );
    }

    setEnrollments(rows);
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
      .eq("company_id", currentCompany.id)
      .eq("is_active", true)
      .order("sort_order");

    if (data) {
      setDivisions(sortDivisionsAlternatingGender(data));
    }
  };

  const filteredEnrollments = useMemo(() => {
    return enrollments.filter((enrollment) => {
      if (selectedSport !== "all" && enrollment.sport_name !== selectedSport) return false;
      if (selectedDivision !== "all" && enrollment.child?.division_id !== selectedDivision) {
        return false;
      }
      if (
        selectedGender !== "all" &&
        enrollment.child?.gender?.toLowerCase() !== selectedGender.toLowerCase()
      ) {
        return false;
      }

      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const searchableFields = [
          sportsAcademyCamperName(enrollment),
          enrollment.sport_name,
          enrollment.instructor,
          enrollment.child?.division?.name,
          ...(enrollment.schedule_periods || []),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!searchableFields.includes(search)) return false;
      }

      return true;
    });
  }, [enrollments, selectedSport, selectedDivision, selectedGender, searchTerm]);

  const calendarRange = useMemo(
    () => sportsAcademyCalendarRange(currentDate, calendarView),
    [currentDate, calendarView],
  );

  const calendarEvents = useMemo(
    () =>
      expandSportsAcademyCalendarEvents(
        filteredEnrollments,
        calendarRange.start,
        calendarRange.end,
      ),
    [filteredEnrollments, calendarRange.start, calendarRange.end],
  );

  const listEvents = useMemo(
    () => expandSportsAcademyCalendarEvents(filteredEnrollments),
    [filteredEnrollments],
  );

  const uniqueSports = useMemo(
    () => [...new Set(enrollments.map((e) => e.sport_name))].sort(),
    [enrollments],
  );

  const activeFilterCount =
    (selectedSport !== "all" ? 1 : 0) +
    (selectedDivision !== "all" ? 1 : 0) +
    (selectedGender !== "all" ? 1 : 0) +
    (searchTerm ? 1 : 0);

  const clearAllFilters = () => {
    setSelectedSport("all");
    setSelectedDivision("all");
    setSelectedGender("all");
    setSearchTerm("");
  };

  const eventPropGetter = (event: SportsAcademyCalendarEvent) => {
    const color = sportColors[event.enrollment.sport_name] || "#64748b";
    return {
      style: {
        backgroundColor: color,
        borderColor: color,
        color: "#fff",
        borderRadius: "4px",
        border: "none",
        fontSize: "12px",
      },
    };
  };

  const formatDateRange = (enrollment: SportsAcademyEnrollment) => {
    if (!enrollment.start_date) return "No dates set";
    const start = new Date(`${enrollment.start_date}T00:00:00`).toLocaleDateString("en-US");
    const end = enrollment.end_date
      ? new Date(`${enrollment.end_date}T00:00:00`).toLocaleDateString("en-US")
      : "Ongoing";
    return `${start} - ${end}`;
  };

  const groupedListEvents = useMemo(() => {
    const groups = new Map<string, SportsAcademyCalendarEvent[]>();
    for (const event of listEvents) {
      const key = event.eventDate;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(event);
    }
    return Array.from(groups.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [listEvents]);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <CalendarIcon className="h-8 w-8" />
            Sports Academy Calendar
          </h1>
          <p className="text-muted-foreground">
            See who has Sports Academy lessons scheduled each day from current enrollments
          </p>
          {hasSportScope && (
            <p className="text-sm text-muted-foreground mt-1">
              Showing {assignedSports.join(", ")} only (your assigned sports).
            </p>
          )}
        </div>

        <ToggleGroup
          type="single"
          value={viewMode}
          onValueChange={(value) => value && setViewMode(value as "calendar" | "list")}
        >
          <ToggleGroupItem value="calendar" aria-label="Calendar view">
            <CalendarIcon className="h-4 w-4 mr-2" />
            Calendar
          </ToggleGroupItem>
          <ToggleGroupItem value="list" aria-label="List view">
            <LayoutList className="h-4 w-4 mr-2" />
            List
          </ToggleGroupItem>
        </ToggleGroup>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search camper, sport, instructor, period..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={selectedDivision} onValueChange={setSelectedDivision}>
              <SelectTrigger className="w-[150px]">
                <SelectValue />
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
                {uniqueSports.map((sport) => (
                  <SelectItem key={sport} value={sport}>
                    {sport}
                  </SelectItem>
                ))}
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
      ) : viewMode === "calendar" ? (
        <Card>
          <CardContent className="p-6">
            {calendarEvents.length === 0 ? (
              <p className="text-muted-foreground text-center py-8">
                No scheduled lessons match your filters for this calendar range
              </p>
            ) : (
              <CalendarZoomWrapper>
                {(height) => (
                  <Calendar
                    localizer={localizer}
                    events={calendarEvents}
                    startAccessor="start"
                    endAccessor="end"
                    style={{ height }}
                    view={calendarView}
                    onView={setCalendarView}
                    date={currentDate}
                    onNavigate={setCurrentDate}
                    onSelectEvent={(event) => setSelectedEvent(event as SportsAcademyCalendarEvent)}
                    eventPropGetter={(event) =>
                      eventPropGetter(event as SportsAcademyCalendarEvent)
                    }
                    popup
                    showAllEvents
                  />
                )}
              </CalendarZoomWrapper>
            )}
          </CardContent>
        </Card>
      ) : groupedListEvents.length === 0 ? (
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground text-center">
              No scheduled lessons match your filters
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {groupedListEvents.map(([dateKey, dayEvents]) => (
            <Card key={dateKey}>
              <CardHeader>
                <CardTitle className="text-lg">
                  {format(new Date(`${dateKey}T12:00:00`), "EEEE, MMMM d, yyyy")}
                  <Badge variant="secondary" className="ml-2">
                    {dayEvents.length} lesson{dayEvents.length === 1 ? "" : "s"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {dayEvents.map((event) => {
                  const enrollment = event.enrollment;
                  return (
                    <div
                      key={event.id}
                      className="border rounded-lg p-4 flex flex-wrap items-start justify-between gap-3"
                    >
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <User className="h-4 w-4" />
                          <span className="font-semibold">{sportsAcademyCamperName(enrollment)}</span>
                          <Badge>{enrollment.sport_name}</Badge>
                          {enrollment.child?.division?.name && (
                            <Badge variant="outline">{enrollment.child.division.name}</Badge>
                          )}
                        </div>
                        {enrollment.instructor && (
                          <p className="text-sm text-muted-foreground">
                            Instructor: {enrollment.instructor}
                          </p>
                        )}
                        {enrollment.schedule_periods?.length ? (
                          <p className="text-sm text-muted-foreground">
                            Periods: {enrollment.schedule_periods.join(", ")}
                          </p>
                        ) : null}
                        <p className="text-sm text-muted-foreground">
                          Enrollment dates: {formatDateRange(enrollment)}
                        </p>
                        {enrollment.weekdays?.length ? (
                          <p className="text-sm text-muted-foreground">
                            Weekdays: {enrollment.weekdays.join(", ")}
                          </p>
                        ) : null}
                      </div>
                      <Button variant="outline" size="sm" onClick={() => setSelectedEvent(event)}>
                        Details
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedEvent} onOpenChange={(open) => !open && setSelectedEvent(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Sports Academy Lesson
            </DialogTitle>
          </DialogHeader>
          {selectedEvent && (
            <div className="space-y-3 text-sm">
              <p>
                <strong>Date:</strong>{" "}
                {format(new Date(`${selectedEvent.eventDate}T12:00:00`), "EEEE, MMMM d, yyyy")}
              </p>
              <p>
                <strong>Camper:</strong> {sportsAcademyCamperName(selectedEvent.enrollment)}
              </p>
              <p>
                <strong>Sport:</strong> {selectedEvent.enrollment.sport_name}
              </p>
              {selectedEvent.enrollment.child?.division?.name && (
                <p>
                  <strong>Division:</strong> {selectedEvent.enrollment.child.division.name}
                </p>
              )}
              {selectedEvent.enrollment.instructor && (
                <p>
                  <strong>Instructor:</strong> {selectedEvent.enrollment.instructor}
                </p>
              )}
              {selectedEvent.enrollment.schedule_periods?.length ? (
                <p>
                  <strong>Periods:</strong> {selectedEvent.enrollment.schedule_periods.join(", ")}
                </p>
              ) : null}
              <p>
                <strong>Enrollment dates:</strong> {formatDateRange(selectedEvent.enrollment)}
              </p>
              {selectedEvent.enrollment.weekdays?.length ? (
                <p>
                  <strong>Weekdays:</strong> {selectedEvent.enrollment.weekdays.join(", ")}
                </p>
              ) : null}
              {selectedEvent.enrollment.notes && (
                <p>
                  <strong>Notes:</strong> {selectedEvent.enrollment.notes}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
