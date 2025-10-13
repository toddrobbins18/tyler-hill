import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { Users, UserCog, Award, FileText, Truck, Calendar } from "lucide-react";

export default function DataManagement() {
  const [stats, setStats] = useState({
    children: 0,
    staff: 0,
    awards: 0,
    dailyNotes: 0,
    trips: 0,
    events: 0,
  });

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    const [children, staff, awards, dailyNotes, trips, events] = await Promise.all([
      supabase.from("children").select("id", { count: "exact", head: true }),
      supabase.from("staff").select("id", { count: "exact", head: true }),
      supabase.from("awards").select("id", { count: "exact", head: true }),
      supabase.from("daily_notes").select("id", { count: "exact", head: true }),
      supabase.from("trips").select("id", { count: "exact", head: true }),
      supabase.from("events").select("id", { count: "exact", head: true }),
    ]);

    setStats({
      children: children.count || 0,
      staff: staff.count || 0,
      awards: awards.count || 0,
      dailyNotes: dailyNotes.count || 0,
      trips: trips.count || 0,
      events: events.count || 0,
    });
  };

  const dataCards = [
    { title: "Children", count: stats.children, icon: Users, color: "text-blue-500" },
    { title: "Staff", count: stats.staff, icon: UserCog, color: "text-green-500" },
    { title: "Awards", count: stats.awards, icon: Award, color: "text-yellow-500" },
    { title: "Daily Notes", count: stats.dailyNotes, icon: FileText, color: "text-purple-500" },
    { title: "Trips", count: stats.trips, icon: Truck, color: "text-orange-500" },
    { title: "Events", count: stats.events, icon: Calendar, color: "text-pink-500" },
  ];

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {dataCards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
            <card.icon className={`h-4 w-4 ${card.color}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.count}</div>
            <p className="text-xs text-muted-foreground">Total records</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
