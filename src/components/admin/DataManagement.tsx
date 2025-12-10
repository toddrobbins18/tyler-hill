import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { toast } from "sonner";
import { Users, UserCog, Award, FileText, Truck, Calendar, Trash2, AlertTriangle } from "lucide-react";

export default function DataManagement() {
  const { currentCompany } = useCompany();
  const [stats, setStats] = useState({
    children: 0,
    staff: 0,
    awards: 0,
    dailyNotes: 0,
    trips: 0,
    events: 0,
  });

  useEffect(() => {
    if (!currentCompany?.id) return;
    fetchStats();
  }, [currentCompany?.id]);

  const fetchStats = async () => {
    if (!currentCompany?.id) return;
    
    const [children, staff, awards, dailyNotes, trips, events] = await Promise.all([
      supabase.from("children").select("id", { count: "exact", head: true }).eq("company_id", currentCompany.id),
      supabase.from("staff").select("id", { count: "exact", head: true }).eq("company_id", currentCompany.id),
      supabase.from("awards").select("id", { count: "exact", head: true }).eq("company_id", currentCompany.id),
      supabase.from("daily_notes").select("id", { count: "exact", head: true }).eq("company_id", currentCompany.id),
      supabase.from("trips").select("id", { count: "exact", head: true }).eq("company_id", currentCompany.id),
      supabase.from("events").select("id", { count: "exact", head: true }).eq("company_id", currentCompany.id),
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

  const deleteTableData = async (tableName: string) => {
    if (!currentCompany?.id) {
      toast.error("No company selected");
      return;
    }
    
    try {
      const { error } = await (supabase as any)
        .from(tableName)
        .delete()
        .eq("company_id", currentCompany.id)
        .neq("id", "00000000-0000-0000-0000-000000000000");

      if (error) throw error;

      toast.success(`All ${tableName} data for ${currentCompany.name} deleted successfully`);
      fetchStats();
    } catch (error) {
      toast.error(`Failed to delete ${tableName} data`);
      console.error(error);
    }
  };

  const deleteAllTestData = async () => {
    if (!currentCompany?.id) {
      toast.error("No company selected");
      return;
    }
    
    const tables = ["children", "staff", "awards", "daily_notes", "trips", "events", 
                    "incident_reports", "medication_logs", "sports_academy", "tutoring_therapy",
                    "activities_field_trips", "special_events_activities", "rainy_day_schedule",
                    "sports_calendar", "menu_items", "special_meals", "health_center_admissions",
                    "trip_attendees", "sports_event_roster"];
    
    try {
      for (const table of tables) {
        await (supabase as any)
          .from(table)
          .delete()
          .eq("company_id", currentCompany.id)
          .neq("id", "00000000-0000-0000-0000-000000000000");
      }
      
      toast.success(`All test data for ${currentCompany.name} deleted successfully`);
      fetchStats();
    } catch (error) {
      toast.error("Failed to delete all test data");
      console.error(error);
    }
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
    <div className="space-y-6">
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>
            Permanently delete data from the database. This action cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="gap-2">
                <Trash2 className="h-4 w-4" />
                Delete All Test Data
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete All Test Data for {currentCompany?.name}</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all data for <strong>{currentCompany?.name}</strong> including children, staff, awards, notes, trips, events, and more. This action cannot be undone. Are you absolutely sure?
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={deleteAllTestData} className="bg-destructive text-destructive-foreground">
                  Delete Everything
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {dataCards.map((card) => (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.count}</div>
              <p className="text-xs text-muted-foreground mb-3">Total records</p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="w-full gap-2">
                    <Trash2 className="h-3 w-3" />
                    Delete All
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {card.title} Data for {currentCompany?.name}</AlertDialogTitle>
                <AlertDialogDescription>
                  This will permanently delete all {card.count} {card.title.toLowerCase()} records for <strong>{currentCompany?.name}</strong>. This action cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteTableData(card.title.toLowerCase().replace(" ", "_"))}>
                      Delete
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
