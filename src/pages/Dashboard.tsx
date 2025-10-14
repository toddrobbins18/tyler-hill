import { Users, Truck, FileText, Award, Utensils, Calendar as CalendarIcon, MapPin } from "lucide-react";
import { StatCard } from "@/components/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalChildren: 0,
    activeRoutes: 0,
    todayNotes: 0,
    weekAwards: 0,
  });
  const [recentNotes, setRecentNotes] = useState<any[]>([]);
  const [upcomingEvents, setUpcomingEvents] = useState<any[]>([]);
  const [todaysMenu, setTodaysMenu] = useState<any>({
    breakfast: "",
    lunch: "",
    snack: "",
    specialNotes: ""
  });

  useEffect(() => {
    fetchDashboardData();

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

    return () => {
      supabase.removeChannel(childrenChannel);
      supabase.removeChannel(notesChannel);
      supabase.removeChannel(awardsChannel);
      supabase.removeChannel(tripsChannel);
      supabase.removeChannel(menuChannel);
    };
  }, []);

  const fetchDashboardData = async () => {
    const today = new Date().toISOString().split('T')[0];
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 7);

    // Fetch children count
    const { count: childrenCount } = await supabase
      .from('children')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Fetch active trips count
    const { count: tripsCount } = await supabase
      .from('trips')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active')
      .gte('date', today);

    // Fetch today's notes count
    const { count: notesCount } = await supabase
      .from('daily_notes')
      .select('*', { count: 'exact', head: true })
      .eq('date', today);

    // Fetch this week's awards
    const { count: awardsCount } = await supabase
      .from('awards')
      .select('*', { count: 'exact', head: true })
      .gte('date', weekStart.toISOString().split('T')[0]);

    // Fetch recent notes
    const { data: notes } = await supabase
      .from('daily_notes')
      .select('*, children(name)')
      .order('created_at', { ascending: false })
      .limit(3);

    // Fetch upcoming trips and events
    const { data: trips } = await supabase
      .from('trips')
      .select('*')
      .gte('date', today)
      .order('date')
      .limit(5);

    // Fetch today's menu
    const { data: menu } = await supabase
      .from('menu_items')
      .select('*')
      .eq('date', today);

    setStats({
      totalChildren: childrenCount || 0,
      activeRoutes: tripsCount || 0,
      todayNotes: notesCount || 0,
      weekAwards: awardsCount || 0,
    });

    setRecentNotes(notes || []);
    
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground mb-2">Dashboard</h1>
        <p className="text-muted-foreground">Welcome back! Here's what's happening today.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Total Children"
          value={stats.totalChildren}
          icon={Users}
          trend="+12 this month"
          variant="default"
        />
        <StatCard
          title="Active Routes"
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-accent/10">
                <Utensils className="h-5 w-5 text-accent" />
              </div>
              <div>
                <CardTitle>Today's Menu</CardTitle>
                <CardDescription>What's being served today</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs font-medium text-muted-foreground mb-1">Breakfast</p>
                <p className="text-sm">{todaysMenu.breakfast}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs font-medium text-muted-foreground mb-1">Lunch</p>
                <p className="text-sm">{todaysMenu.lunch}</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <p className="text-xs font-medium text-muted-foreground mb-1">Snack</p>
                <p className="text-sm">{todaysMenu.snack}</p>
              </div>
            </div>
            <div className="p-2 rounded bg-info/10 border border-info/20">
              <p className="text-xs text-info-foreground">{todaysMenu.specialNotes}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <CardTitle>Recent Notes</CardTitle>
            <CardDescription>Latest updates from your team</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {recentNotes.length === 0 ? (
              <p className="text-muted-foreground text-sm">No recent notes</p>
            ) : (
              recentNotes.map((note) => (
                <div key={note.id} className="flex items-start justify-between p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer" onClick={() => navigate('/notes')}>
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{note.children?.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(note.created_at).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            )}
            <Button variant="outline" className="w-full" onClick={() => navigate('/notes')}>View All Notes</Button>
          </CardContent>
        </Card>

        <Card className="shadow-card">
          <CardHeader>
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <CalendarIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle>Upcoming Events</CardTitle>
                <CardDescription>Calendar & schedule</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {upcomingEvents.length === 0 ? (
              <p className="text-muted-foreground text-sm">No upcoming events</p>
            ) : (
              upcomingEvents.map((event) => (
                <div key={event.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors cursor-pointer" onClick={() => navigate('/transportation')}>
                  <div className="flex-1">
                    <p className="font-medium text-sm mb-1">{event.title}</p>
                    <span className="text-xs text-muted-foreground">{event.date}</span>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {event.type === "trip" && <MapPin className="h-3 w-3 mr-1" />}
                    {event.type}
                  </Badge>
                </div>
              ))
            )}
            <Button variant="outline" className="w-full" onClick={() => navigate('/transportation')}>View Full Calendar</Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
