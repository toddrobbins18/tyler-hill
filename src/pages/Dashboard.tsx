import { Users, Truck, FileText, Award, Utensils, Calendar as CalendarIcon, CalendarDays, MapPin, Cake, Trophy, Activity, Quote, Phone, Shirt, User, Camera, Globe, CalendarOff, Palmtree } from "lucide-react";
import { useTigerTimesColors } from "@/hooks/useTigerTimesColors";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePermissions } from "@/hooks/usePermissions";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useCompany } from "@/contexts/CompanyContext";
import { WeatherWidget } from "@/components/WeatherWidget";
import NotesBoard from "@/components/dashboard/NotesBoard";
import { DashboardWidgetGrid } from "@/components/dashboard/DashboardWidgetGrid";
import { CompactInfoCard } from "@/components/dashboard/CompactInfoCard";
import timberLakeWestBg from "@/assets/timber-lake-west-bg.jpeg";
import tylerHillDashboardBg from "@/assets/image001.jpg";
import timberLakeCampHero from "@/assets/tember-camp.jpeg";
import { addDays, format } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { isActiveRosterStatus, isBirthdayTodayCalendar, parseBirthdayCalendarParts } from "@/lib/birthdayCalendar";
import { isTimberLakeCamp, isTimberLakeWestCompany, isTylerHillCamp, shouldShowTigerTimes } from "@/lib/camps";
import { formatTime12Hour } from "@/lib/utils";

interface DailyWolfContent {
  officer_of_day: string;
  laundry_info: string;
  phone_calls_info: string;
  quote_of_the_day: string;
  notes: string;
  picture_day: string;
  outside_event: string;
  staff_days_off: string;
  od_notes: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { getDivisionFilter } = usePermissions();
  const ttColors = useTigerTimesColors();
  const { userRole } = useAuth();
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [stats, setStats] = useState({
    totalChildren: 0,
    activeRoutes: 0,
    todayNotes: 0,
    weekAwards: 0,
  });
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  /** Timber Lake Camp: today's rows from `activities_field_trips` */
  const [activitiesToday, setActivitiesToday] = useState<any[]>([]);
  const [specialEvents, setSpecialEvents] = useState<any[]>([]);
  const [sportsEvents, setSportsEvents] = useState<any[]>([]);
  const [threeDayOutlook, setThreeDayOutlook] = useState<any[]>([]);
  const [todaysBirthdays, setTodaysBirthdays] = useState<any[]>([]);
  const [staffBirthdays, setStaffBirthdays] = useState<any[]>([]);
  const [healthCenterAdmissions, setHealthCenterAdmissions] = useState<any[]>([]);
  const [dailyWolfContent, setDailyWolfContent] = useState<DailyWolfContent | null>(null);
  const [todaysMenuItems, setTodaysMenuItems] = useState<any[]>([]);

  useEffect(() => {
    if (currentCompany?.id) {
      fetchDashboardData();
      if (isTimberLakeWestCompany(currentCompany) || shouldShowTigerTimes(currentCompany)) {
        fetchDailyWolfContent();
      }
    }

    // Realtime subscriptions for live updates
    const childrenChannel = supabase
      .channel('dashboard-children')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'children' }, fetchDashboardData)
      .subscribe();

    const notesChannel = supabase
      .channel('dashboard-notes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_notes' }, fetchDashboardData)
      .subscribe();

    const awardsChannel = supabase
      .channel('dashboard-awards')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'awards' }, fetchDashboardData)
      .subscribe();

    const tripsChannel = supabase
      .channel('dashboard-trips')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, fetchDashboardData)
      .subscribe();

    const activitiesFieldTripsChannel = supabase
      .channel('dashboard-activities-field-trips')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'activities_field_trips' }, fetchDashboardData)
      .subscribe();

    const menuChannel = supabase
      .channel('dashboard-menu')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'menu_items' }, fetchDashboardData)
      .subscribe();

    const specialEventsChannel = supabase
      .channel('dashboard-special-events')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'special_events_activities' }, fetchDashboardData)
      .subscribe();

    const sportsChannel = supabase
      .channel('dashboard-sports')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sports_calendar' }, fetchDashboardData)
      .subscribe();

    const healthCenterChannel = supabase
      .channel('dashboard-health-center')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'health_center_admissions' }, fetchDashboardData)
      .subscribe();

    const staffChannel = supabase
      .channel('dashboard-staff')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'staff' }, fetchDashboardData)
      .subscribe();

    const dailyWolfChannel = supabase
      .channel('dashboard-daily-wolf')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_wolf_content' }, () => {
        if (isTimberLakeWestCompany(currentCompany) || shouldShowTigerTimes(currentCompany)) {
          fetchDailyWolfContent();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(childrenChannel);
      supabase.removeChannel(notesChannel);
      supabase.removeChannel(awardsChannel);
      supabase.removeChannel(tripsChannel);
      supabase.removeChannel(activitiesFieldTripsChannel);
      supabase.removeChannel(menuChannel);
      supabase.removeChannel(specialEventsChannel);
      supabase.removeChannel(sportsChannel);
      supabase.removeChannel(healthCenterChannel);
      supabase.removeChannel(staffChannel);
      supabase.removeChannel(dailyWolfChannel);
    };
  }, [currentCompany?.id, currentCompany?.slug, currentSeason]);

  const fetchDailyWolfContent = async () => {
    if (!currentCompany) return;
    
    const today = format(new Date(), 'yyyy-MM-dd');
    
    const { data, error } = await supabase
      .from('daily_wolf_content')
      .select('*')
      .eq('company_id', currentCompany.id)
      .eq('date', today)
      .eq('season', currentSeason)
      .maybeSingle();
    
    if (data) {
      setDailyWolfContent({
        officer_of_day: data.officer_of_day || '',
        laundry_info: data.laundry_info || '',
        phone_calls_info: data.phone_calls_info || '',
        quote_of_the_day: data.quote_of_the_day || '',
        notes: data.notes || '',
        picture_day: (data as any).picture_day || '',
        outside_event: (data as any).outside_event || '',
        staff_days_off: (data as any).staff_days_off || '',
        od_notes: (data as any).od_notes || '',
      });
    } else {
      setDailyWolfContent(null);
    }
  };

  const fetchDashboardData = async () => {
    if (!currentCompany?.id) return;
    
    const todayDate = new Date();
    const today = format(todayDate, "yyyy-MM-dd");
    const tripWindowEnd = format(addDays(todayDate, 2), "yyyy-MM-dd");
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const divisionFilter = getDivisionFilter();
    
    // Check if user has full access (no division restrictions)
    const hasFullAccess = divisionFilter === null;

    // Fetch children count with division filtering
    let childrenQuery = supabase
      .from('children')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('company_id', currentCompany.id);
    
    if (divisionFilter !== null && divisionFilter.length > 0) {
      childrenQuery = childrenQuery.in('division_id', divisionFilter);
    }
    
    const { count: childrenCount } = await childrenQuery;

    // Fetch active trips count
    let tripsCountQuery = supabase
      .from('trips')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('company_id', currentCompany.id)
      .gte('date', today);
    if (currentCompany.slug === 'timber-lake-camp') {
      tripsCountQuery = tripsCountQuery.eq('season', currentSeason);
    }
    const { count: tripsCount } = await tripsCountQuery;

    // Fetch today's notes count - need to join with children for division filtering
    let notesQuery = supabase
      .from('daily_notes')
      .select('*, children:child_id(division_id)', { count: 'exact', head: true })
      .eq('date', today)
      .eq('company_id', currentCompany.id);
    
    if (!hasFullAccess && divisionFilter && divisionFilter.length > 0) {
      // Filter notes by children in user's divisions
      const { data: childrenInDivisions } = await supabase
        .from('children')
        .select('id')
        .eq('company_id', currentCompany.id)
        .in('division_id', divisionFilter);
      
      const childIds = (childrenInDivisions || []).map(c => c.id);
      if (childIds.length > 0) {
        notesQuery = notesQuery.in('child_id', childIds);
      }
    }
    
    const { count: notesCount } = await notesQuery;

    // Fetch this week's awards with division filtering
    let awardsQuery = supabase
      .from('awards')
      .select('*, children:child_id(division_id)', { count: 'exact', head: true })
      .eq('company_id', currentCompany.id)
      .gte('date', weekStart.toISOString().split('T')[0]);
    
    if (!hasFullAccess && divisionFilter && divisionFilter.length > 0) {
      const { data: childrenInDivisions } = await supabase
        .from('children')
        .select('id')
        .eq('company_id', currentCompany.id)
        .in('division_id', divisionFilter);
      
      const childIds = (childrenInDivisions || []).map(c => c.id);
      if (childIds.length > 0) {
        awardsQuery = awardsQuery.in('child_id', childIds);
      }
    }
    
    const { count: awardsCount } = await awardsQuery;

    let upcomingTripsQuery = supabase
      .from('trips')
      .select('*')
      .eq('company_id', currentCompany.id)
      .gte('date', today)
      .order('date')
      .limit(5);
    if (isTimberLakeCamp(currentCompany.slug)) {
      upcomingTripsQuery = upcomingTripsQuery
        .eq('season', currentSeason)
        .lte('date', tripWindowEnd);
    }
    const { data: trips } = await upcomingTripsQuery;

    let activitiesTodayData: any[] = [];
    if (currentCompany.slug === 'timber-lake-camp') {
      const { data: acts } = await supabase
        .from('activities_field_trips')
        .select('*')
        .eq('company_id', currentCompany.id)
        .eq('event_date', today)
        .eq('season', currentSeason);
      let list = acts || [];
      if (!hasFullAccess && divisionFilter && divisionFilter.length > 0) {
        list = list.filter(
          (a: any) => !a.division_id || divisionFilter.includes(a.division_id),
        );
      }
      activitiesTodayData = list;
    }
    setActivitiesToday(activitiesTodayData);

    // Fetch today's menu
    const menuResult = await supabase
      .from('menu_items')
      .select('*')
      .eq('date', today)
      .eq('company_id', currentCompany.id);
    const menu = menuResult.data;

    // Fetch special events for today with division filtering
    let specialEventsData: any[] = [];
    try {
      let specialQuery = supabase
        .from('special_events_activities')
        .select('*')
        .eq('event_date', today)
        .eq('company_id', currentCompany.id);
      
      const result = await specialQuery;
      let events = result.data || [];
      
      // Filter by division if user has restricted access and events have division_id
      if (!hasFullAccess && divisionFilter && divisionFilter.length > 0) {
        events = events.filter((event: any) => 
          !event.division_id || divisionFilter.includes(event.division_id)
        );
      }
      
      specialEventsData = events;
    } catch (error) {
      console.error('Error fetching special events:', error);
    }

    // Fetch sports calendar events for today with division filtering
    let sportsData: any[] = [];
    try {
      // First get sports events with their divisions
      const result = await supabase
        .from('sports_calendar')
        .select('*')
        .eq('event_date', today)
        .eq('company_id', currentCompany.id);
      
      let events = result.data || [];
      
      // If user has division restrictions, filter events by divisions
      if (!hasFullAccess && divisionFilter && divisionFilter.length > 0) {
        // Get division associations for these events
        const eventIds = events.map((e: any) => e.id);
        if (eventIds.length > 0) {
          const { data: divisionAssocs } = await supabase
            .from('sports_calendar_divisions')
            .select('sports_event_id, division_id')
            .in('sports_event_id', eventIds);
          
          // Filter to only events that have at least one matching division
          events = events.filter((event: any) => {
            const eventDivisions = (divisionAssocs || [])
              .filter((d: any) => d.sports_event_id === event.id)
              .map((d: any) => d.division_id);
            
            // Include if no divisions specified (camp-wide) or user has access to at least one
            return eventDivisions.length === 0 || 
              eventDivisions.some((divId: string) => divisionFilter.includes(divId));
          });
        }
      }
      
      sportsData = events;
    } catch (error) {
      console.error('Error fetching sports events:', error);
    }

    // Fetch sports calendar events for the next 3 days (for Tyler Hill Camp) with division filtering
    let threeDayData: any[] = [];
    if (currentCompany?.slug === 'tyler-hill-camp') {
      try {
        const threeDaysFromNow = new Date();
        threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);
        const threeDaysFromNowStr = threeDaysFromNow.toISOString().split('T')[0];
        
        const result = await supabase
          .from('sports_calendar')
          .select('*')
          .eq('company_id', currentCompany.id)
          .gt('event_date', today)
          .lte('event_date', threeDaysFromNowStr)
          .order('event_date', { ascending: true });
        
        let events = result.data || [];
        
        // Apply division filtering if user has restrictions
        if (!hasFullAccess && divisionFilter && divisionFilter.length > 0) {
          const eventIds = events.map((e: any) => e.id);
          if (eventIds.length > 0) {
            const { data: divisionAssocs } = await supabase
              .from('sports_calendar_divisions')
              .select('sports_event_id, division_id')
              .in('sports_event_id', eventIds);
            
            events = events.filter((event: any) => {
              const eventDivisions = (divisionAssocs || [])
                .filter((d: any) => d.sports_event_id === event.id)
                .map((d: any) => d.division_id);
              
              return eventDivisions.length === 0 || 
                eventDivisions.some((divId: string) => divisionFilter.includes(divId));
            });
          }
        }
        
        threeDayData = events;
      } catch (error) {
        console.error('Error fetching three day outlook:', error);
      }
    }

    // Fetch birthdays for today (matching month and day) with division filtering
    let birthdayQuery = supabase
      .from('children')
      .select('id, name, date_of_birth, division_id, status')
      .eq('company_id', currentCompany.id)
      .not('date_of_birth', 'is', null);

    if (currentSeason) {
      birthdayQuery = birthdayQuery.eq('season', currentSeason);
    }
    
    if (!hasFullAccess && divisionFilter && divisionFilter.length > 0) {
      birthdayQuery = birthdayQuery.in('division_id', divisionFilter);
    }
    
    const { data: childrenRaw } = await birthdayQuery;
    const childrenData = (childrenRaw || []).filter((child: { status?: string | null }) =>
      isActiveRosterStatus(child.status),
    );

    let staffBirthdayQuery = supabase
      .from('staff')
      .select('id, name, date_of_birth, status')
      .eq('company_id', currentCompany.id)
      .not('date_of_birth', 'is', null);

    if (currentSeason) {
      staffBirthdayQuery = staffBirthdayQuery.eq('season', currentSeason);
    }

    const { data: staffBirthdayRaw } = await staffBirthdayQuery;
    const staffBirthdayData = (staffBirthdayRaw || []).filter((staff: { status?: string | null }) =>
      isActiveRosterStatus(staff.status),
    );

    const todayMonth = todayDate.getMonth() + 1;
    const todayDay = todayDate.getDate();

    const birthdaysToday = (childrenData || []).filter((child: any) =>
      isBirthdayTodayCalendar(child.date_of_birth, todayMonth, todayDay),
    );

    const staffBirthdaysToday = (staffBirthdayData || []).filter((staff: any) =>
      isBirthdayTodayCalendar(staff.date_of_birth, todayMonth, todayDay),
    );

    // Fetch health center admissions (not yet checked out) with division filtering
    let healthCenterQuery = supabase
      .from('health_center_admissions')
      .select('*, children:child_id(id, name, division_id)')
      .eq('company_id', currentCompany.id)
      .eq('season', currentSeason)
      .is('checked_out_at', null)
      .order('admitted_at', { ascending: false });

    if (divisionFilter !== null && divisionFilter.length > 0) {
      healthCenterQuery = healthCenterQuery.in('children.division_id', divisionFilter);
    }

    const { data: healthCenterData } = await healthCenterQuery;

    setStats({
      totalChildren: childrenCount || 0,
      activeRoutes: tripsCount || 0,
      todayNotes: notesCount || 0,
      weekAwards: awardsCount || 0,
    });

    setSpecialEvents(specialEventsData || []);
    setSportsEvents(sportsData || []);
    setThreeDayOutlook(threeDayData || []);
    setTodaysBirthdays(birthdaysToday);
    setStaffBirthdays(staffBirthdaysToday);
    setHealthCenterAdmissions(healthCenterData || []);
    
    const eventsData = trips?.map(trip => ({
      id: trip.id,
      title: trip.name,
      date: new Date(trip.date + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      departureTime: trip.departure_time ? formatTime12Hour(trip.departure_time) : '',
      type: trip.type,
    })) || [];
    setUpcomingEvents(eventsData);

    if (menu && menu.length > 0) {
      const mealOrder: Record<string, number> = {
        breakfast: 1,
        lunch: 2,
        snack: 3,
        dinner: 4,
        special_meal: 5,
      };
      const sortedMenu = [...menu].sort((a, b) => {
        const aKey = (a.meal_type || "").toLowerCase();
        const bKey = (b.meal_type || "").toLowerCase();
        const orderDiff = (mealOrder[aKey] ?? 99) - (mealOrder[bKey] ?? 99);
        if (orderDiff !== 0) return orderDiff;
        return (a.items || "").localeCompare(b.items || "");
      });
      setTodaysMenuItems(sortedMenu);
    } else {
      setTodaysMenuItems([]);
    }
  };

  const formatDashboardMealTypeLabel = (mealType: string) => {
    if (mealType === "special_meal") return "Special Meal";
    return mealType.charAt(0).toUpperCase() + mealType.slice(1);
  };

  const showTigerTimes = shouldShowTigerTimes(currentCompany);
  const isTimberLakeWest = isTimberLakeWestCompany(currentCompany);
  const isTylerHill = isTylerHillCamp(currentCompany?.slug);
  const hasDashboardAerialBg = isTimberLakeWest || isTylerHill || showTigerTimes;
  const dashboardAerialBgSrc = isTylerHill
    ? tylerHillDashboardBg
    : showTigerTimes
      ? timberLakeCampHero
      : timberLakeWestBg;
  const dashboardTitle = showTigerTimes
    ? "Tiger Times"
    : isTimberLakeWest
      ? "The Daily Wolf"
      : isTylerHill
        ? "The Bear"
        : "Dashboard";

  const menuMeals = todaysMenuItems;
  const glassCardClass = hasDashboardAerialBg ? "bg-card/50 backdrop-blur-md border-white/30" : "";
  const widgetHeaderClass = "flex flex-row items-center justify-between gap-2 p-4 pb-2 space-y-0";
  const widgetTitleClass = "text-base font-semibold leading-tight";
  const widgetContentClass = "px-4 pb-4 pt-0";
  const widgetLinkClass = "h-auto shrink-0 p-0 text-xs font-medium text-primary hover:underline";
  const widgetIconWrapClass = "shrink-0 rounded-md p-1.5";
  
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const formattedDate = now.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const formattedTime = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });

  const calculateAge = (dateOfBirth: string): number => {
    const today = new Date();
    const parts = parseBirthdayCalendarParts(dateOfBirth);
    if (!parts) return 0;
    let age = today.getFullYear() - parts.year;
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();
    if (todayMonth < parts.month || (todayMonth === parts.month && todayDay < parts.day)) {
      age--;
    }
    return age;
  };

  return (
    <div 
      className={`${hasDashboardAerialBg ? "space-y-5" : "space-y-8"} min-h-screen relative`}
      style={hasDashboardAerialBg ? {
        backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url(${dashboardAerialBgSrc})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        margin: '-2rem',
        padding: '2rem',
      } : undefined}
    >
      <div className={`flex items-baseline justify-between gap-4 ${hasDashboardAerialBg ? "text-white" : ""}`}>
        <h1 className={`text-3xl font-bold ${hasDashboardAerialBg ? "mb-0 text-white drop-shadow-lg" : "mb-0 text-foreground"}`}>{dashboardTitle}</h1>
        <div className={`shrink-0 text-right ${hasDashboardAerialBg ? "text-white/80 drop-shadow" : "text-muted-foreground"}`}>
          <p className="text-lg">{formattedDate}</p>
          <p className={`text-sm font-semibold ${hasDashboardAerialBg ? "text-white" : "text-foreground"}`}>{formattedTime}</p>
        </div>
      </div>

      {!showTigerTimes && !isTylerHill && !isTimberLakeWest && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Children"
            value={stats.totalChildren}
            icon={Users}
            trend="+12 this month"
            variant="default"
          />
          <StatCard
            title="Today's Transportation"
            value={stats.activeRoutes}
            icon={Truck}
            trend="All on schedule"
            variant="success"
          />
          <StatCard
            title="Today's Notes"
            value={stats.todayNotes}
            icon={FileText}
            trend="3 pending review"
            variant="info"
          />
          <StatCard
            title="Achievements"
            value={stats.weekAwards}
            icon={Award}
            trend="This week"
            variant="warning"
          />
        </div>
      )}

      {/* Unified Dashboard Grid */}
      <DashboardWidgetGrid balanced={hasDashboardAerialBg}>

        {/* Weather Widget */}
        {currentCompany?.zip_code && (
          <WeatherWidget zipCode={currentCompany.zip_code} className={glassCardClass} compact={hasDashboardAerialBg} />
        )}

        {/* Today's Menu Card */}
        <Card className={`shadow-card ${glassCardClass}`}>
          <CardHeader className={widgetHeaderClass}>
            <div className="flex min-w-0 items-center gap-2">
              <div className={`${widgetIconWrapClass} bg-orange-500/10`}>
                <Utensils className="h-4 w-4 text-orange-500" />
              </div>
              <CardTitle className={widgetTitleClass}>Today&apos;s Menu</CardTitle>
              </div>
            <Button variant="link" className={widgetLinkClass} onClick={() => navigate("/menu")}>
              View menu
            </Button>
          </CardHeader>
          <CardContent className={`${widgetContentClass} space-y-2`}>
            {menuMeals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No meals scheduled for today</p>
            ) : (
              <div className={`grid gap-2 ${menuMeals.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
                {menuMeals.map((item) => (
                  <div key={item.id} className="rounded-lg bg-muted/50 p-2.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                      {formatDashboardMealTypeLabel(item.meal_type)}
                    </p>
                    <p className="mt-0.5 text-sm font-medium whitespace-pre-wrap">{item.items}</p>
                    {item.allergens && (
                      <p className="text-xs text-muted-foreground mt-1">Allergens: {item.allergens}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Timber Lake Camp: today's activities & upcoming trips */}
        {showTigerTimes && (
          <>
            <Card className={`shadow-card ${glassCardClass}`}>
              <CardHeader className={widgetHeaderClass}>
                <div className="flex min-w-0 items-center gap-2">
                  <div className={`${widgetIconWrapClass} bg-emerald-500/10`}>
                    <Palmtree className="h-4 w-4 text-emerald-600" />
                  </div>
                  <CardTitle className={widgetTitleClass}>Activities &amp; Field Trips</CardTitle>
                  </div>
                <Button variant="link" className={widgetLinkClass} onClick={() => navigate("/activities")}>
                  View all
                </Button>
              </CardHeader>
              <CardContent className={`${widgetContentClass} space-y-2`}>
                {activitiesToday.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No activities or field trips today</p>
                ) : (
                  <div className="space-y-1.5">
                    {activitiesToday.map((act) => (
                      <div
                        key={act.id}
                        className="flex cursor-pointer items-start gap-2 rounded-lg bg-muted/50 p-2 transition-colors hover:bg-muted"
                        onClick={() => navigate("/activities")}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{act.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {(formatTime12Hour(act.time) || act.time || "Time TBD") + (act.location ? ` · ${act.location}` : "")}
                          </p>
                        </div>
                        <Badge variant="outline" className="shrink-0 text-xs">{act.activity_type || "Activity"}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className={`shadow-card ${glassCardClass}`}>
              <CardHeader className={widgetHeaderClass}>
                <div className="flex min-w-0 items-center gap-2">
                  <div className={`${widgetIconWrapClass} bg-sky-500/10`}>
                    <Truck className="h-4 w-4 text-sky-600" />
                  </div>
                  <CardTitle className={widgetTitleClass}>Upcoming Trips</CardTitle>
                  </div>
                <Button variant="link" className={widgetLinkClass} onClick={() => navigate("/transportation")}>
                  View all
                </Button>
              </CardHeader>
              <CardContent className={`${widgetContentClass} space-y-2`}>
                <p className="text-xs text-muted-foreground">Next 3 days</p>
                {upcomingEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No upcoming trips</p>
                ) : (
                  <div className="space-y-1.5">
                    {upcomingEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="flex cursor-pointer items-start gap-2 rounded-lg bg-muted/50 p-2 transition-colors hover:bg-muted"
                        onClick={() => navigate("/transportation")}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium">{ev.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {[ev.date, ev.departureTime, ev.type].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {isTimberLakeWest && (
          <Card className={`shadow-card ${glassCardClass}`}>
            <CardHeader className={widgetHeaderClass}>
              <div className="flex min-w-0 items-center gap-2">
                <div className={`${widgetIconWrapClass} bg-purple-500/10`}>
                  <CalendarIcon className="h-4 w-4 text-purple-500" />
                </div>
                <CardTitle className={widgetTitleClass}>Evening Activities</CardTitle>
                </div>
              <Button variant="link" className={widgetLinkClass} onClick={() => navigate("/special-events")}>
                View all
              </Button>
            </CardHeader>
            <CardContent className={`${widgetContentClass} space-y-2`}>
              {specialEvents.filter((e) => e.event_type === "evening-activity").length === 0 ? (
                <p className="text-sm text-muted-foreground">No evening activities tonight</p>
              ) : (
                <div className="space-y-1.5">
                  {specialEvents.filter((e) => e.event_type === "evening-activity").map((event) => (
                    <div key={event.id} className="flex cursor-pointer items-start gap-2 rounded-lg bg-muted/50 p-2 transition-colors hover:bg-muted" onClick={() => navigate("/special-events")}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{event.title}</p>
                        <span className="text-xs text-muted-foreground">{formatTime12Hour(event.time_slot) || event.time_slot || "All day"}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {isTimberLakeWest && (
          <Card className={`shadow-card ${glassCardClass}`}>
            <CardHeader className={widgetHeaderClass}>
              <div className="flex min-w-0 items-center gap-2">
                <div className={`${widgetIconWrapClass} bg-primary/10`}>
                  <CalendarIcon className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className={widgetTitleClass}>Special Events</CardTitle>
                </div>
              <Button variant="link" className={widgetLinkClass} onClick={() => navigate("/special-events")}>
                View all
              </Button>
            </CardHeader>
            <CardContent className={`${widgetContentClass} space-y-2`}>
              {specialEvents.filter((e) => e.event_type !== "evening-activity").length === 0 ? (
                <p className="text-sm text-muted-foreground">No special events today</p>
              ) : (
                <div className="space-y-1.5">
                  {specialEvents.filter((e) => e.event_type !== "evening-activity").map((event) => (
                    <div key={event.id} className="flex cursor-pointer items-start gap-2 rounded-lg bg-muted/50 p-2 transition-colors hover:bg-muted" onClick={() => navigate("/special-events")}>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium">{event.title}</p>
                        <span className="text-xs text-muted-foreground">{formatTime12Hour(event.time_slot) || event.time_slot || "All day"}</span>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-xs">{event.type}</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Athletics Schedule Card */}
        <Card className={`shadow-card ${glassCardClass}`}>
          <CardHeader className={widgetHeaderClass}>
            <div className="flex min-w-0 items-center gap-2">
              <div className={`${widgetIconWrapClass} bg-warning/10`}>
                <Trophy className="h-4 w-4 text-warning" />
              </div>
              <CardTitle className={widgetTitleClass}>Athletics Schedule</CardTitle>
              </div>
            <Button variant="link" className={widgetLinkClass} onClick={() => navigate("/athletics")}>
              View schedule
            </Button>
          </CardHeader>
          <CardContent className={`${widgetContentClass} space-y-2`}>
              {sportsEvents.length === 0 && (!isTylerHill || threeDayOutlook.length === 0) ? (
              <p className="text-sm text-muted-foreground">No sports events today</p>
            ) : sportsEvents.length > 0 ? (
              <div className="space-y-1 rounded-lg border-l-4 border-info bg-info/5 p-2 dark:bg-info/10">
                {isTylerHill && (
                  <div className="mb-1 flex items-center gap-2">
                    <CalendarIcon className="h-3.5 w-3.5 text-info" />
                    <p className="text-xs font-semibold uppercase tracking-wide text-info">Today</p>
                    </div>
                  )}
                  {sportsEvents.map((event) => (
                  <div key={event.id} className="flex cursor-pointer items-center gap-2 rounded-lg bg-card p-2 transition-colors hover:bg-muted/50" onClick={() => navigate("/athletics")}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{event.title}</p>
                      <p className="truncate text-xs text-muted-foreground">{formatTime12Hour(event.time) || event.time || "TBD"}</p>
                      </div>
                    <Badge variant="outline" className="shrink-0 text-xs">{event.sport_type}</Badge>
                    </div>
                  ))}
            </div>
            ) : null}

            {isTylerHill && threeDayOutlook.length > 0 && (
              <div className="space-y-1 rounded-lg border-l-4 border-warning bg-warning/5 p-2 dark:bg-warning/10">
                <div className="mb-1 flex items-center gap-2">
                  <CalendarDays className="h-3.5 w-3.5 text-warning" />
                  <p className="text-xs font-semibold uppercase tracking-wide text-warning">Three Day Outlook</p>
                </div>
                {threeDayOutlook.map((event) => (
                  <div key={event.id} className="flex cursor-pointer items-center gap-2 rounded-lg bg-card p-2 transition-colors hover:bg-muted/50" onClick={() => navigate("/athletics")}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{event.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {new Date(event.event_date + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} • {formatTime12Hour(event.time) || event.time || "TBD"}
                      </p>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs">{event.sport_type}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Today's Birthdays Card */}
        <Card className={`shadow-card ${glassCardClass}`}>
          <CardHeader className={widgetHeaderClass}>
            <div className="flex min-w-0 items-center gap-2">
              <div className={`${widgetIconWrapClass} bg-success/10`}>
                <Cake className="h-4 w-4 text-success" />
              </div>
              <CardTitle className={widgetTitleClass}>Today&apos;s Birthdays</CardTitle>
            </div>
          </CardHeader>
          <CardContent className={`${widgetContentClass} space-y-2`}>
            {todaysBirthdays.length === 0 && staffBirthdays.length === 0 ? (
              <p className="text-sm text-muted-foreground">No birthdays today</p>
            ) : (
              <div className="space-y-2">
                {todaysBirthdays.map((child: any) => (
                  <div key={child.id} className="flex items-center gap-2.5 rounded-lg border border-success/20 bg-success/10 p-2.5">
                    <Cake className="h-4 w-4 shrink-0 text-success" />
                    <div>
                      <p className="text-sm font-medium">{child.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Turning {calculateAge(child.date_of_birth)} today! 🎂
                      </p>
                    </div>
                  </div>
                ))}
                {staffBirthdays.map((staff: any) => (
                  <div key={staff.id} className="flex items-center gap-2.5 rounded-lg border border-primary/20 bg-primary/10 p-2.5">
                    <Cake className="h-4 w-4 shrink-0 text-primary" />
                    <div>
                      <p className="text-sm font-medium">{staff.name}</p>
                      <p className="text-xs text-muted-foreground">Staff Member 🎉</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {!isTimberLakeWest && (
        <Card className={`shadow-card ${glassCardClass}`}>
          <CardHeader className={widgetHeaderClass}>
            <div className="flex min-w-0 items-center gap-2">
              <div className={`${widgetIconWrapClass} bg-primary/10`}>
                <CalendarIcon className="h-4 w-4 text-primary" />
              </div>
              <CardTitle className={widgetTitleClass}>Special Events &amp; Activities</CardTitle>
              </div>
            <Button variant="link" className={widgetLinkClass} onClick={() => navigate("/special-events")}>
              View all
            </Button>
          </CardHeader>
          <CardContent className={`${widgetContentClass} space-y-2`}>
            {specialEvents.length === 0 ? (
              <p className="text-sm text-muted-foreground">No special events today</p>
            ) : (
              <div className="space-y-1.5">
                {specialEvents.map((event) => (
                  <div key={event.id} className="flex cursor-pointer items-start gap-2 rounded-lg bg-muted/50 p-2 transition-colors hover:bg-muted" onClick={() => navigate("/special-events")}>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{event.title}</p>
                      <span className="text-xs text-muted-foreground">{formatTime12Hour(event.time_slot) || event.time_slot || "All day"}</span>
                    </div>
                    <Badge variant="outline" className="shrink-0 text-xs">{event.type}</Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        )}

        {/* Notes Board for Tyler Hill - next to Special Events */}
        {isTylerHill && (
          <NotesBoard className={glassCardClass} compact={hasDashboardAerialBg} />
        )}

        {/* Health Center Card - Timber Lake only */}
        {showTigerTimes && healthCenterAdmissions.length > 0 && (
          <Card className={`shadow-card ${glassCardClass}`}>
            <CardHeader className={widgetHeaderClass}>
              <div className="flex min-w-0 items-center gap-2">
                <div className={`${widgetIconWrapClass} bg-destructive/10`}>
                  <Activity className="h-4 w-4 text-destructive" />
                </div>
                <CardTitle className={widgetTitleClass}>Health Center</CardTitle>
              </div>
            </CardHeader>
            <CardContent className={`${widgetContentClass} space-y-2`}>
              <div className="space-y-2">
                  {healthCenterAdmissions.map((admission: any) => (
                  <div key={admission.id} className="flex items-start justify-between rounded-lg border border-border bg-accent/50 p-2.5">
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-foreground">
                        {admission.children?.name || "Unknown"}
                        </div>
                        {admission.reason && (
                        <p className="mt-0.5 text-sm text-muted-foreground">{admission.reason}</p>
                      )}
                      <div className="mt-0.5 text-xs text-muted-foreground">
                        Admitted: {new Date(admission.admitted_at).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
            </CardContent>
          </Card>
        )}
      </DashboardWidgetGrid>

      {/* Daily Wolf Content for Timber Lake West - at the bottom */}
      {isTimberLakeWest && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CompactInfoCard
            title="Super OD"
            value={dailyWolfContent?.officer_of_day || "Not set"}
            icon={User}
            iconClassName="text-primary"
            iconWrapClassName="bg-primary/10"
          />
          <CompactInfoCard
            title="Starfish Quote of the Day"
            value={dailyWolfContent?.quote_of_the_day ? `"${dailyWolfContent.quote_of_the_day}"` : "No quote set"}
            icon={Quote}
            iconClassName="text-amber-600"
            iconWrapClassName="bg-amber-500/10"
          />
          <CompactInfoCard
            title="Laundry"
            value={dailyWolfContent?.laundry_info || "No laundry info"}
            icon={Shirt}
            iconClassName="text-blue-600"
            iconWrapClassName="bg-blue-500/10"
          />
          <CompactInfoCard
            title="Phone Calls"
            value={dailyWolfContent?.phone_calls_info || "No phone call info"}
            icon={Phone}
            iconClassName="text-green-600"
            iconWrapClassName="bg-green-500/10"
          />
          {dailyWolfContent?.notes && (
            <CompactInfoCard
              className="sm:col-span-2 lg:col-span-4"
              title="Daily Notes"
              value={dailyWolfContent.notes}
              icon={FileText}
              iconClassName="text-purple-600"
              iconWrapClassName="bg-purple-500/10"
            />
          )}
        </div>
      )}

      {/* Tiger Times Content for Timber Lake Camp */}
      {showTigerTimes && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <CompactInfoCard
            title="Laundry"
            value={dailyWolfContent?.laundry_info || "No info"}
            icon={Shirt}
            iconClassName="text-foreground"
            iconWrapClassName="bg-muted"
            style={{ borderTopWidth: "3px", borderTopColor: ttColors["Laundry"] }}
          />
          <CompactInfoCard
            title="Phone Calls"
            value={dailyWolfContent?.phone_calls_info || "No info"}
            icon={Phone}
            iconClassName="text-foreground"
            iconWrapClassName="bg-muted"
            style={{ borderTopWidth: "3px", borderTopColor: ttColors["Phone Calls"] }}
          />
          <CompactInfoCard
            title="Outside Events"
            value={dailyWolfContent?.outside_event || "No info"}
            icon={Globe}
            iconClassName="text-foreground"
            iconWrapClassName="bg-muted"
            style={{ borderTopWidth: "3px", borderTopColor: ttColors["Outside Events"] }}
          />
          <CompactInfoCard
            title="Staff Days Off"
            value={dailyWolfContent?.staff_days_off || "No info"}
            icon={CalendarOff}
            iconClassName="text-foreground"
            iconWrapClassName="bg-muted"
            style={{ borderTopWidth: "3px", borderTopColor: ttColors["Staff Days Off"] }}
          />
          <CompactInfoCard
            title="OD Notes"
            value={dailyWolfContent?.od_notes || "No info"}
            icon={FileText}
            iconClassName="text-foreground"
            iconWrapClassName="bg-muted"
            style={{ borderTopWidth: "3px", borderTopColor: ttColors["OD Notes"] }}
          />
        </div>
      )}
    </div>
  );
}
