import type { ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  PhoneCall,
  Stethoscope,
  Trophy,
  Truck,
  Users,
  Waves,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export type CamperProfileServiceCounts = {
  swimLessons: number;
  swimProgramSeasons: number;
  healthVisits: number;
  namedFieldTrips: number;
  divisionActivities: number;
  sportsEvents: number;
  incidents: number;
  tutoring: number;
  parentContacts?: number;
};

type ServiceRow = {
  key: string;
  label: string;
  count: number;
  tab: string;
  icon: ReactNode;
  hint?: string;
};

export function CamperProfileServicesSummary({
  counts,
  onNavigateTab,
}: {
  counts: CamperProfileServiceCounts;
  onNavigateTab: (tab: string) => void;
}) {
  const rows: ServiceRow[] = [
    {
      key: "swim",
      label: "Swim",
      count: counts.swimLessons + counts.swimProgramSeasons,
      tab: "swim",
      icon: <Waves className="h-4 w-4 text-sky-600" />,
      hint:
        counts.swimLessons > 0
          ? `${counts.swimLessons} lesson${counts.swimLessons === 1 ? "" : "s"}`
          : counts.swimProgramSeasons > 0
            ? `${counts.swimProgramSeasons} program season${counts.swimProgramSeasons === 1 ? "" : "s"}`
            : undefined,
    },
    {
      key: "health",
      label: "Health Center",
      count: counts.healthVisits,
      tab: "health-center",
      icon: <Stethoscope className="h-4 w-4 text-rose-600" />,
    },
    {
      key: "activities",
      label: "Activities & Trips",
      count: counts.sportsEvents + counts.namedFieldTrips + counts.divisionActivities,
      tab: "activities",
      icon: <Activity className="h-4 w-4 text-emerald-600" />,
      hint:
        counts.divisionActivities > 0
          ? `${counts.divisionActivities} division field trip${counts.divisionActivities === 1 ? "" : "s"}`
          : undefined,
    },
    {
      key: "incidents",
      label: "Incident Reports",
      count: counts.incidents,
      tab: "incidents",
      icon: <AlertTriangle className="h-4 w-4 text-amber-600" />,
    },
    {
      key: "tutoring",
      label: "Tutoring & Therapy",
      count: counts.tutoring,
      tab: "tutoring-therapy",
      icon: <BookOpen className="h-4 w-4 text-violet-600" />,
    },
  ];

  if (counts.parentContacts != null) {
    rows.push({
      key: "parent-contact",
      label: "Parent Contact Log",
      count: counts.parentContacts,
      tab: "parent-contact",
      icon: <PhoneCall className="h-4 w-4 text-primary" />,
    });
  }

  const totalLinked = rows.reduce((sum, r) => sum + r.count, 0);

  return (
    <Card className="shadow-card md:col-span-2">
      <CardHeader>
        <CardTitle className="text-base">Camper services</CardTitle>
        <CardDescription>
          Swim, health, trips, incidents, and tutoring linked to this roster record ({totalLinked}{" "}
          {totalLinked === 1 ? "item" : "items"})
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((row) => (
            <Button
              key={row.key}
              type="button"
              variant="outline"
              className="h-auto justify-start gap-3 px-3 py-3 text-left"
              onClick={() => onNavigateTab(row.tab)}
            >
              <span className="mt-0.5 shrink-0">{row.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">{row.label}</span>
                  <span className="tabular-nums text-sm text-muted-foreground">{row.count}</span>
                </span>
                {row.hint ? (
                  <span className="block text-xs text-muted-foreground truncate">{row.hint}</span>
                ) : null}
              </span>
            </Button>
          ))}
        </div>
        <p className="mt-3 text-xs text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="inline-flex items-center gap-1">
            <Truck className="h-3 w-3" /> Named trip roster
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="h-3 w-3" /> Division field trips
          </span>
          <span className="inline-flex items-center gap-1">
            <Trophy className="h-3 w-3" /> Sports events
          </span>
        </p>
      </CardContent>
    </Card>
  );
}
