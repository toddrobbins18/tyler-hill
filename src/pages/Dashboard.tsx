import { Users, Truck, FileText, Award, Utensils, Calendar as CalendarIcon, CalendarDays, MapPin, Cake, Trophy, Activity, Quote, Phone, Shirt, User } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import timberLakeWestBg from "@/assets/timber-lake-west-bg.jpeg";
import { format } from "date-fns";

interface DailyWolfContent {
  officer_of_day: string;
  laundry_info: string;
  phone_calls_info: string;
  quote_of_the_day: string;
  notes: string;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const { getDivisionFilter } = usePermissions();
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [stats, setStats] = useState({
    totalChildren: 0,
    activeRoutes: 0,
    todayNotes: 0,
    weekAwards: 0,
  });
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [specialEvents, setSpecialEvents] = useState<any[]>([]);
  const [sportsEvents, setSportsEvents] = useState<any[]>([]);
  const [threeDayOutlook, setThreeDayOutlook] = useState<any[]>([]);
  const [todaysBirthdays, setTodaysBirthdays] = useState<any[]>([]);
  const [staffBirthdays, setStaffBirthdays] = useState<any[]>([]);
  const [healthCenterAdmissions, setHealthCenterAdmissions] = useState<any[]>([]);
  const [dailyWolfContent, setDailyWolfContent] = useState<DailyWolfContent | null>(null);
  const [todaysMenu, setTodaysMenu] = useState<any>({
    breakfast: "",
    lunch: "",
    snack: "",
    dinner: "",
    specialNotes: ""
  });

  useEffect(() => {
    if (currentCompany?.id) {
      fetchDashboardData();
      if (currentCompany.slug === 'timber-lake-west') {
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
        if (currentCompany?.slug === 'timber-lake-west') {
          fetchDailyWolfContent();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(childrenChannel);
      supabase.removeChannel(notesChannel);
      supabase.removeChannel(awardsChannel);
      supabase.removeChannel(tripsChannel);
      supabase.removeChannel(menuChannel);
      supabase.removeChannel(specialEventsChannel);
      supabase.removeChannel(sportsChannel);
      supabase.removeChannel(healthCenterChannel);
      supabase.removeChannel(staffChannel);
      supabase.removeChannel(dailyWolfChannel);
    };
  }, [currentCompany?.id, currentCompany?.slug]);

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
      });
    } else {
      setDailyWolfContent(null);
    }
  };

  const fetchDashboardData = async () => {
    if (!currentCompany?.id) return;
    
    const today = new Date().toISOString().split('T')[0];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);
    const divisionFilter = getDivisionFilter();

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
    const { count: tripsCount } = await supabase
      .from('trips')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .eq('company_id', currentCompany.id)
      .gte('date', today);

    // Fetch today's notes count
    const { count: notesCount } = await supabase
      .from('daily_notes')
      .select('*', { count: 'exact', head: true })
      .eq('date', today)
      .eq('company_id', currentCompany.id);

    // Fetch this week's awards
    const { count: awardsCount } = await supabase
      .from('awards')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', currentCompany.id)
      .gte('date', weekStart.toISOString().split('T')[0]);

    // Fetch upcoming trips and events
    const { data: trips } = await supabase
      .from('trips')
      .select('*')
      .eq('company_id', currentCompany.id)
      .gte('date', today)
      .order('date')
      .limit(5);

    // Fetch today's menu
    const menuResult = await supabase
      .from('menu_items')
      .select('*')
      .eq('date', today)
      .eq('company_id', currentCompany.id);
    const menu = menuResult.data;

    // Fetch special events for today
    let specialEventsData: any[] = [];
    try {
      const result = await supabase
        .from('special_events_activities')
        .select('*')
        .eq('event_date', today)
        .eq('company_id', currentCompany.id);
      specialEventsData = result.data || [];
    } catch (error) {
      console.error('Error fetching special events:', error);
    }

    // Fetch sports calendar events for today
    let sportsData: any[] = [];
    try {
      const result = await supabase
        .from('sports_calendar')
        .select('*')
        .eq('event_date', today)
        .eq('company_id', currentCompany.id);
      sportsData = result.data || [];
    } catch (error) {
      console.error('Error fetching sports events:', error);
    }

    // Fetch sports calendar events for the next 3 days (for Tyler Hill Camp)
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
        threeDayData = result.data || [];
      } catch (error) {
        console.error('Error fetching three day outlook:', error);
      }
    }

    // Fetch birthdays for today (matching month and day)
    const { data: childrenData } = await supabase
      .from('children')
      .select('id, name, date_of_birth')
      .eq('status', 'active')
      .eq('company_id', currentCompany.id)
      .not('date_of_birth', 'is', null);

    const { data: staffBirthdayData } = await supabase
      .from('staff')
      .select('id, name, date_of_birth')
      .eq('status', 'active')
      .eq('company_id', currentCompany.id)
      .not('date_of_birth', 'is', null);

    const todayDate = new Date();
    const todayMonth = todayDate.getMonth() + 1;
    const todayDay = todayDate.getDate();

    const birthdaysToday = (childrenData || []).filter((child: any) => {
      if (!child.date_of_birth) return false;
      // Parse date string directly to avoid timezone issues
      const [year, month, day] = child.date_of_birth.split('-').map(Number);
      return month === todayMonth && day === todayDay;
    });

    const staffBirthdaysToday = (staffBirthdayData || []).filter((staff: any) => {
      if (!staff.date_of_birth) return false;
      // Parse date string directly to avoid timezone issues
      const [year, month, day] = staff.date_of_birth.split('-').map(Number);
      return month === todayMonth && day === todayDay;
    });

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
      date: new Date(trip.date + 'T00:00:00').toLocaleDateString('en-US'),
      type: trip.type
    })) || [];
    setUpcomingEvents(eventsData);

    if (menu && menu.length > 0) {
      const menuData: any = {};
      menu.forEach(item => {
        menuData[item.meal_type] = item.items;
      });
      setTodaysMenu({
        breakfast: menuData.breakfast || "Not scheduled",
        lunch: menuData.lunch || "Not scheduled",
        snack: menuData.snack || "Not scheduled",
        dinner: menuData.dinner || "Not scheduled",
        specialNotes: menu[0]?.allergens || ""
      });
    }
  };

  const isTimberLakeCamp = currentCompany?.slug === 'timber-lake-camp';
  const isTimberLakeWest = currentCompany?.slug === 'timber-lake-west';
  const isTylerHillCamp = currentCompany?.slug === 'tyler-hill-camp';
  const dashboardTitle = isTimberLakeCamp ? "Tiger Times" : isTimberLakeWest ? "The Daily Wolf" : "Dashboard";
  
  // Glass card styles for Timber Lake West and Tyler Hill - increased transparency
  const glassCardClass = (isTimberLakeWest || isTylerHillCamp) ? 'bg-card/50 backdrop-blur-md border-white/30' : '';
  const glassButtonClass = (isTimberLakeWest || isTylerHillCamp) ? 'bg-card/50 backdrop-blur-md border-white/40 hover:bg-card/70' : '';
  
  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  const calculateAge = (dateOfBirth: string): number => {
    const today = new Date();
    // Parse date string directly to avoid timezone issues
    const [year, month, day] = dateOfBirth.split('-').map(Number);
    let age = today.getFullYear() - year;
    const todayMonth = today.getMonth() + 1;
    const todayDay = today.getDate();
    if (todayMonth < month || (todayMonth === month && todayDay < day)) {
      age--;
    }
    return age;
  };

  return (
    <div 
      className="space-y-8 min-h-screen relative"
      style={isTimberLakeWest ? {
        backgroundImage: `linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.6)), url(${timberLakeWestBg})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
        margin: '-2rem',
        padding: '2rem',
      } : undefined}
    >
      <div className={isTimberLakeWest ? 'text-white' : ''}>
        <h1 className={`text-3xl font-bold mb-2 ${isTimberLakeWest ? 'text-white drop-shadow-lg' : 'text-foreground'}`}>{dashboardTitle}</h1>
        {isTimberLakeCamp ? (
          <p className={isTimberLakeWest ? 'text-white/80 drop-shadow' : 'text-muted-foreground'}>{formattedDate}</p>
        ) : isTimberLakeWest ? (
          <p className="text-white/80 drop-shadow">{formattedDate}</p>
        ) : (
          <p className={isTimberLakeWest ? 'text-white/80 drop-shadow' : 'text-muted-foreground'}>Welcome back! Here's what's happening today.</p>
        )}
      </div>


      {!isTimberLakeCamp && !isTylerHillCamp && !isTimberLakeWest && (
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
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">

        {/* Weather Widget */}
        {currentCompany?.zip_code && (
          <WeatherWidget zipCode={currentCompany.zip_code} className={glassCardClass} />
        )}

        {/* Today's Menu Card */}
        <Card className={`shadow-card h-full flex flex-col ${glassCardClass}`}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <Utensils className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <CardTitle>Today's Menu</CardTitle>
                <CardDescription>Meal schedule for today</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 flex-1 flex flex-col">
            <div className="grid grid-cols-2 gap-3 flex-1">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Breakfast</p>
                <p className="text-sm font-medium mt-1 line-clamp-2">{todaysMenu.breakfast}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Lunch</p>
                <p className="text-sm font-medium mt-1 line-clamp-2">{todaysMenu.lunch}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Snack</p>
                <p className="text-sm font-medium mt-1 line-clamp-2">{todaysMenu.snack}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs font-semibold text-muted-foreground uppercase">Dinner</p>
                <p className="text-sm font-medium mt-1 line-clamp-2">{todaysMenu.dinner}</p>
              </div>
            </div>
            {todaysMenu.specialNotes && (
              <div className="p-2 rounded-lg bg-warning/10 border border-warning/20">
                <p className="text-xs text-warning-foreground">
                  <span className="font-semibold">Allergens: </span>
                  {todaysMenu.specialNotes}
                </p>
              </div>
            )}
            <Button variant="outline" className={`w-full mt-auto ${glassButtonClass}`} onClick={() => navigate('/menu')}>
              View Full Menu
            </Button>
          </CardContent>
        </Card>

        {/* Athletics Schedule Card */}
        <Card className={`shadow-card h-full flex flex-col ${isTylerHillCamp && threeDayOutlook.length > 0 ? 'lg:col-span-2 lg:row-span-1' : ''} ${glassCardClass}`}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-warning/10">
                <Trophy className="h-5 w-5 text-warning" />
              </div>
              <div>
                <CardTitle>Athletics Schedule</CardTitle>
                <CardDescription>{isTylerHillCamp ? "Today & upcoming events" : "Today's sports events"}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4 flex-1 flex flex-col">
            {/* Today's Events */}
            <div className="space-y-3 p-3 rounded-lg bg-info/5 dark:bg-info/10 border-l-4 border-info">
              {sportsEvents.length === 0 ? (
                <p className="text-muted-foreground text-sm">No sports events today</p>
              ) : (
                <>
                  {isTylerHillCamp && (
                    <div className="flex items-center gap-2 mb-2">
                      <CalendarIcon className="h-4 w-4 text-info" />
                      <p className="text-sm font-semibold text-info uppercase tracking-wide">Today</p>
                    </div>
                  )}
                  {sportsEvents.map((event) => (
                    <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg bg-card hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate('/athletics')}>
                      <div className="flex-1">
                        <p className="font-medium text-sm mb-1">{event.title}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>{event.time || 'TBD'}</span>
                          {event.location && (
                            <>
                              <span>•</span>
                              <span>{event.location}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <Badge variant="outline" className="text-xs">{event.sport_type}</Badge>
                    </div>
                  ))}
                </>
              )}
            </div>

            {/* Three Day Outlook - Tyler Hill Camp only */}
            {isTylerHillCamp && threeDayOutlook.length > 0 && (
              <div className="space-y-3 p-3 rounded-lg bg-warning/5 dark:bg-warning/10 border-l-4 border-warning">
                <div className="flex items-center gap-2 mb-2">
                  <CalendarDays className="h-4 w-4 text-warning" />
                  <p className="text-sm font-semibold text-warning uppercase tracking-wide">Three Day Outlook</p>
                </div>
                {threeDayOutlook.map((event) => (
                  <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg bg-card hover:bg-muted/50 transition-colors cursor-pointer" onClick={() => navigate('/athletics')}>
                    <div className="flex-1">
                      <p className="font-medium text-sm mb-1">{event.title}</p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
                        <span>•</span>
                        <span>{event.time || 'TBD'}</span>
                        {event.location && (
                          <>
                            <span>•</span>
                            <span>{event.location}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">{event.sport_type}</Badge>
                  </div>
                ))}
              </div>
            )}

            <Button variant="outline" className={`w-full mt-auto ${glassButtonClass}`} onClick={() => navigate('/athletics')}>View Full Schedule</Button>
          </CardContent>
        </Card>

        {/* Today's Birthdays Card */}
        <Card className={`shadow-card h-full flex flex-col ${glassCardClass}`}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-success/10">
                <Cake className="h-5 w-5 text-success" />
              </div>
              <div>
                <CardTitle>Today's Birthdays</CardTitle>
                <CardDescription>Celebrate with them!</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 flex-1 flex flex-col">
            {todaysBirthdays.length === 0 && staffBirthdays.length === 0 ? (
              <p className="text-muted-foreground text-sm">No birthdays today</p>
            ) : (
              <div className="space-y-3 flex-1">
                {todaysBirthdays.map((child: any) => (
                  <div key={child.id} className="flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/20">
                    <Cake className="h-5 w-5 text-success" />
                    <div>
                      <p className="font-medium text-sm">{child.name}</p>
                      <p className="text-xs text-muted-foreground">
                        Turning {calculateAge(child.date_of_birth)} today! 🎂
                      </p>
                    </div>
                  </div>
                ))}
                {staffBirthdays.map((staff: any) => (
                  <div key={staff.id} className="flex items-center gap-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
                    <Cake className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-medium text-sm">{staff.name}</p>
                      <p className="text-xs text-muted-foreground">Staff Member 🎉</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Evening Activities Card - Timber Lake West only */}
        {isTimberLakeWest && (
          <Card className={`shadow-card h-full flex flex-col ${glassCardClass}`}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-purple-500/10">
                  <CalendarIcon className="h-5 w-5 text-purple-500" />
                </div>
                <div>
                  <CardTitle>Evening Activities</CardTitle>
                  <CardDescription>Tonight's schedule</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3 flex-1 flex flex-col">
              {specialEvents.filter(e => e.event_type === 'evening-activity').length === 0 ? (
                <p className="text-muted-foreground text-sm">No evening activities tonight</p>
              ) : (
                <div className="space-y-3 flex-1">
                  {specialEvents.filter(e => e.event_type === 'evening-activity').map((event) => (
                    <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer" onClick={() => navigate('/special-events')}>
                      <div className="flex-1">
                        <p className="font-medium text-sm mb-1">{event.title}</p>
                        <span className="text-xs text-muted-foreground">{event.time_slot || 'All day'}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <Button variant="outline" className={`w-full mt-auto ${glassButtonClass}`} onClick={() => navigate('/special-events')}>View All Events</Button>
            </CardContent>
          </Card>
        )}

        {/* Special Events & Activities Card */}
        <Card className={`shadow-card h-full flex flex-col ${glassCardClass}`}>
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <CalendarIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Special Events & Activities</CardTitle>
                <CardDescription>Today's schedule</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 flex-1 flex flex-col">
            {(isTimberLakeWest ? specialEvents.filter(e => e.event_type !== 'evening-activity') : specialEvents).length === 0 ? (
              <p className="text-muted-foreground text-sm">No special events today</p>
            ) : (
              <div className="space-y-3 flex-1">
                {(isTimberLakeWest ? specialEvents.filter(e => e.event_type !== 'evening-activity') : specialEvents).map((event) => (
                  <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer" onClick={() => navigate('/special-events')}>
                    <div className="flex-1">
                      <p className="font-medium text-sm mb-1">{event.title}</p>
                      <span className="text-xs text-muted-foreground">{event.time_slot || 'All day'}</span>
                    </div>
                    <Badge variant="outline" className="text-xs">{event.type}</Badge>
                  </div>
                ))}
              </div>
            )}
            <Button variant="outline" className={`w-full mt-auto ${glassButtonClass}`} onClick={() => navigate('/special-events')}>View All Events</Button>
          </CardContent>
        </Card>

        {/* Notes Board for Tyler Hill - next to Special Events */}
        {isTylerHillCamp && (
          <NotesBoard className={glassCardClass} />
        )}

        {/* Health Center Card - Timber Lake only */}
        {isTimberLakeCamp && healthCenterAdmissions.length > 0 && (
          <Card className={`shadow-card h-full flex flex-col ${glassCardClass}`}>
            <CardHeader>
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-destructive/10">
                  <Activity className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <CardTitle>Health Center</CardTitle>
                  <CardDescription>Current admissions</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1">
              {healthCenterAdmissions.length === 0 ? (
                <p className="text-muted-foreground text-sm">No current admissions</p>
              ) : (
                <div className="space-y-3">
                  {healthCenterAdmissions.map((admission: any) => (
                    <div key={admission.id} className="flex items-start justify-between p-3 rounded-lg bg-accent/50 border border-border">
                      <div className="flex-1">
                        <div className="font-medium text-foreground">
                          {admission.children?.name || 'Unknown'}
                        </div>
                        {admission.reason && (
                          <p className="text-sm text-muted-foreground mt-1">
                            {admission.reason}
                          </p>
                        )}
                        <div className="text-xs text-muted-foreground mt-1">
                          Admitted: {new Date(admission.admitted_at).toLocaleTimeString('en-US', { 
                            hour: 'numeric', 
                            minute: '2-digit' 
                          })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Daily Wolf Content for Timber Lake West - at the bottom */}
      {isTimberLakeWest && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-card/80 backdrop-blur-sm shadow-lg border-white/20">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-primary/10">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <CardTitle className="text-base">Super OD</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-lg font-semibold text-foreground">
                {dailyWolfContent?.officer_of_day || 'Not set'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm shadow-lg border-white/20">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-amber-500/10">
                  <Quote className="h-4 w-4 text-amber-600" />
                </div>
                <CardTitle className="text-base">Starfish Quote of the Day</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm italic text-muted-foreground">
                {dailyWolfContent?.quote_of_the_day ? `"${dailyWolfContent.quote_of_the_day}"` : 'No quote set'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm shadow-lg border-white/20">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <Shirt className="h-4 w-4 text-blue-600" />
                </div>
                <CardTitle className="text-base">Laundry</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {dailyWolfContent?.laundry_info || 'No laundry info'}
              </p>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm shadow-lg border-white/20">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-lg bg-green-500/10">
                  <Phone className="h-4 w-4 text-green-600" />
                </div>
                <CardTitle className="text-base">Phone Calls</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground whitespace-pre-line">
                {dailyWolfContent?.phone_calls_info || 'No phone call info'}
              </p>
            </CardContent>
          </Card>

          {dailyWolfContent?.notes && (
            <Card className="bg-card/80 backdrop-blur-sm shadow-lg border-white/20 md:col-span-2 lg:col-span-4">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-2 rounded-lg bg-purple-500/10">
                    <FileText className="h-4 w-4 text-purple-600" />
                  </div>
                  <CardTitle className="text-base">Daily Notes</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-line">
                  {dailyWolfContent.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
