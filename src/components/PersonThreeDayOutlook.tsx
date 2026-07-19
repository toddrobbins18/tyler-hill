import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Activity, CalendarDays, Trophy, Truck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchChildScheduleOutlook,
  fetchStaffScheduleOutlook,
  formatOutlookDateDisplay,
  groupOutlookItemsByKind,
  type PersonOutlookItem,
} from "@/lib/personScheduleOutlook";
import { formatTime12Hour } from "@/lib/utils";

type PersonThreeDayOutlookProps = {
  personType: "child" | "staff";
  personId: string;
  companyId: string;
  season?: string | null;
  divisionId?: string | null;
  staffName?: string | null;
};

function OutlookSection({
  title,
  icon,
  items,
  emptyLabel,
}: {
  title: string;
  icon: ReactNode;
  items: PersonOutlookItem[];
  emptyLabel: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <p className="text-sm font-semibold">{title}</p>
        <Badge variant="secondary" className="text-xs">
          {items.length}
        </Badge>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground pl-6">{emptyLabel}</p>
      ) : (
        <div className="space-y-1.5 pl-1">
          {items.map((item) => (
            <div key={item.id} className="rounded-lg border border-border/60 bg-muted/30 p-2.5">
              <p className="text-sm font-medium">{item.title}</p>
              <p className="text-xs text-muted-foreground">
                {[
                  formatOutlookDateDisplay(item.date),
                  item.endDate && item.endDate !== item.date
                    ? `– ${formatOutlookDateDisplay(item.endDate)}`
                    : null,
                  item.time ? formatTime12Hour(item.time) || item.time : null,
                  item.location,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {item.meta ? (
                <p className="text-xs text-muted-foreground mt-0.5">{item.meta}</p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function PersonThreeDayOutlook({
  personType,
  personId,
  companyId,
  season,
  divisionId,
  staffName,
}: PersonThreeDayOutlookProps) {
  const [items, setItems] = useState<PersonOutlookItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const data =
          personType === "child"
            ? await fetchChildScheduleOutlook(supabase, {
                childId: personId,
                divisionId,
                companyId,
                season,
              })
            : await fetchStaffScheduleOutlook(supabase, {
                staffId: personId,
                staffName: staffName || "",
                companyId,
                season,
              });
        if (!cancelled) setItems(data);
      } catch (error) {
        console.error("[PersonThreeDayOutlook] Failed to load schedule:", error);
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (personId && companyId && (personType === "child" || staffName)) {
      load();
    } else {
      setItems([]);
      setLoading(false);
    }

    return () => {
      cancelled = true;
    };
  }, [personType, personId, companyId, season, divisionId, staffName]);

  const grouped = useMemo(() => groupOutlookItemsByKind(items), [items]);
  const totalCount = items.length;

  return (
    <Card className="shadow-card md:col-span-2">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CalendarDays className="h-5 w-5 text-primary" />
          <CardTitle>Three Day Outlook</CardTitle>
        </div>
        <CardDescription>
          Trips, sporting events, and activities assigned to them over the next 3 days
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading schedule...</p>
        ) : totalCount === 0 ? (
          <p className="text-sm text-muted-foreground">
            Nothing scheduled in the next 3 days.
          </p>
        ) : (
          <div className="grid gap-6 md:grid-cols-3">
            <OutlookSection
              title="Trips"
              icon={<Truck className="h-4 w-4 text-sky-600" />}
              items={grouped.trips}
              emptyLabel="No trips"
            />
            <OutlookSection
              title="Sporting Events"
              icon={<Trophy className="h-4 w-4 text-primary" />}
              items={grouped.sports}
              emptyLabel="No sporting events"
            />
            <OutlookSection
              title="Activities"
              icon={<Activity className="h-4 w-4 text-emerald-600" />}
              items={grouped.activities}
              emptyLabel="No activities"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}
