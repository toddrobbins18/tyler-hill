import { Users, Truck, FileText, Award, Utensils, Calendar as CalendarIcon, CalendarDays, MapPin, Cake, Trophy } from "lucide-react";
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

export default function Dashboard() {
  const navigate = useNavigate();
  const { getDivisionFilter } = usePermissions();
  const { currentCompany } = useCompany();
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
  const [todaysMenu, setTodaysMenu] = useState<any>({
    breakfast: "",
    lunch: "",
    snack: "",
    specialNotes: ""
  });

  useEffect(() => {
    if (currentCompany?.id) {
      fetchDashboardData();
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

    return () => {
      supabase.removeChannel(childrenChannel);
      supabase.removeChannel(notesChannel);
      supabase.removeChannel(awardsChannel);
      supabase.removeChannel(tripsChannel);
      supabase.removeChannel(menuChannel);
      supabase.removeChannel(specialEventsChannel);
      supabase.removeChannel(sportsChannel);
    };
  }, [currentCompany?.id]);

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
    const { data: staffData } = await supabase
      .from('children')
      .select('id, name, date_of_birth')
      .eq('status', 'active')
      .eq('company_id', currentCompany.id)
      .not('date_of_birth', 'is', null);

    const todayDate = new Date();
    const todayMonth = todayDate.getMonth() + 1;
    const todayDay = todayDate.getDate();

    const birthdaysToday = (staffData || []).filter((child: any) => {
      if (!child.date_of_birth) return false;
      const birthDate = new Date(child.date_of_birth);
      return (birthDate.getMonth() + 1) === todayMonth && birthDate.getDate() === todayDay;
    });

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
    
    const eventsData = trips?.map(trip => ({
      id: trip.id,
      title: trip.name,
      date: new Date(trip.date).toLocaleDateString(),
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
        specialNotes: menu[0]?.allergens || "Nut-free facility"
      });
    }
  };

  const isTimberLakeCamp = currentCompany?.slug === 'timber-lake-camp';
  const isTylerHillCamp = currentCompany?.slug === 'tyler-hill-camp';
  const dashboardTitle = isTimberLakeCamp ? "Tiger Times" : "Dashboard";
  
  const today = new Date();
  const formattedDate = today.toLocaleDateString('en-US', { 
    weekday: 'long', 
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">{dashboardTitle}</h1>
        {isTimberLakeCamp ? (
          <p className="text-muted-foreground">{formattedDate}</p>
        ) : (
          <p className="text-muted-foreground">Welcome back! Here's what's happening today.</p>
        )}
      </div>

      {!isTimberLakeCamp && !isTylerHillCamp && (
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

      <div className={`grid gap-6 ${isTimberLakeCamp || isTylerHillCamp ? 'md:grid-cols-2' : 'md:grid-cols-2 lg:grid-cols-3'}`}>

        <Card className="shadow-card">
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
          <CardContent className="space-y-3">
            {specialEvents.length === 0 ? (
              <p className="text-muted-foreground text-sm">No special events today</p>
            ) : (
              specialEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer" onClick={() => navigate('/special-events')}>
                  <div className="flex-1">
                    <p className="font-medium text-sm mb-1">{event.title}</p>
                    <span className="text-xs text-muted-foreground">{event.time_slot || 'All day'}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">{event.type}</Badge>
                </div>
              ))
            )}
            <Button variant="outline" className="w-full" onClick={() => navigate('/special-events')}>View All Events</Button>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <Card className="shadow-card">
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
          <CardContent className="space-y-4">
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
                        <span>{new Date(event.event_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</span>
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

            <Button variant="outline" className="w-full" onClick={() => navigate('/athletics')}>View Full Schedule</Button>
          </CardContent>
        </Card>

        <Card className="shadow-card">
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
          <CardContent className="space-y-3">
            {todaysBirthdays.length === 0 ? (
              <p className="text-muted-foreground text-sm">No birthdays today</p>
            ) : (
              todaysBirthdays.map((child: any) => (
                <div key={child.id} className="flex items-center gap-3 p-3 rounded-lg bg-success/10 border border-success/20">
                  <Cake className="h-5 w-5 text-success" />
                  <div>
                    <p className="font-medium text-sm">{child.name}</p>
                    <p className="text-xs text-muted-foreground">
                      Born {new Date(child.date_of_birth).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
