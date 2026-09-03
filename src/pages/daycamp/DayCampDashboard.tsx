import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useNavigate } from "react-router-dom";
import { Sun, Truck, Waves, HeartPulse, Search, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";

const quickActions = [
  {
    title: "Sunshine Report",
    description: "Daily camper tracking sheet",
    icon: Sun,
    url: "/day-camp/sunshine-report",
    buttonLabel: "Open Sunshine Report",
    className: "bg-emerald-600 hover:bg-emerald-700 text-white border-0",
  },
  {
    title: "Transport",
    description: "Manage routes and pickups",
    icon: Truck,
    url: "/day-camp/transport",
    buttonLabel: "Open Transport",
    className: "bg-sky-600 hover:bg-sky-700 text-white border-0",
  },
  {
    title: "Swim Bracelets",
    description: "Approve and send swim bracelet reports",
    icon: Waves,
    url: "/day-camp/swim-bracelets",
    buttonLabel: "Open Swim Bracelets",
    className: "bg-cyan-600 hover:bg-cyan-700 text-white border-0",
  },
  {
    title: "Health Center",
    description: "Day camp health records",
    icon: HeartPulse,
    url: "/day-camp/health-center",
    buttonLabel: "Open Health Center",
    className: "bg-violet-600 hover:bg-violet-700 text-white border-0",
  },
] as const;

export default function DayCampDashboard() {
  const navigate = useNavigate();
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [totalCampers, setTotalCampers] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (!currentCompany?.id) return;

    const fetchCamperCount = async () => {
      let query = supabase
        .from("children")
        .select("id", { count: "exact", head: true })
        .eq("company_id", currentCompany.id)
        .eq("status", "active");

      if (currentSeason) {
        query = query.eq("season", currentSeason);
      }

      const { count } = await query;
      setTotalCampers(count ?? 0);
    };

    fetchCamperCount();
  }, [currentCompany?.id, currentSeason]);

  const todayLabel = format(new Date(), "EEEE, MMMM d, yyyy");

  return (
    <div className="space-y-8 max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            {todayLabel} — Welcome back!
          </p>
        </div>
        <Card className="shrink-0 border-primary/20 bg-primary/5">
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold leading-none">{totalCampers}</p>
              <p className="text-sm text-muted-foreground">
                Active campers{currentSeason ? ` (${currentSeason})` : ""}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="relative max-w-xl">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name, phone, email, address"
          className="pl-10"
          disabled
          title="Search will be enabled when camper data is loaded"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {quickActions.map((action) => (
          <Card
            key={action.title}
            className={`overflow-hidden ${action.className}`}
          >
            <CardContent className="flex h-full flex-col gap-4 p-6">
              <action.icon className="h-10 w-10 opacity-90" />
              <div className="space-y-1">
                <h2 className="text-xl font-semibold">{action.title}</h2>
                <p className="text-sm opacity-90">{action.description}</p>
              </div>
              <Button
                variant="secondary"
                className="mt-auto w-fit bg-white/20 text-white hover:bg-white/30 border-0"
                onClick={() => navigate(action.url)}
              >
                {action.buttonLabel}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
