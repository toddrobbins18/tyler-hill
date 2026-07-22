import { useEffect, useMemo, useState } from "react";
import { Activity, CalendarDays, Trophy, Truck } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import {
  fetchSupervisorScheduleOutlook,
  groupOutlookItemsByDate,
  outlookDayHeading,
  resolveSupervisorOutlookScope,
  type PersonOutlookItem,
} from "@/lib/personScheduleOutlook";
import { formatTime12Hour } from "@/lib/utils";

const KIND_LABEL: Record<PersonOutlookItem["kind"], string> = {
  trip: "Trip",
  sport: "Sport",
  activity: "Activity",
};

const KIND_ICON: Record<PersonOutlookItem["kind"], typeof Trophy> = {
  trip: Truck,
  sport: Trophy,
  activity: Activity,
};

type SupervisorThreeDayOutlookProps = {
  className?: string;
  headerClassName?: string;
  titleClassName?: string;
  contentClassName?: string;
  linkClassName?: string;
  iconWrapClassName?: string;
};

export default function SupervisorThreeDayOutlook({
  className,
  headerClassName = "flex flex-row items-center justify-between gap-2 p-4 pb-2 space-y-0",
  titleClassName = "text-base font-semibold leading-tight",
  contentClassName = "px-4 pb-4 pt-0",
  linkClassName = "h-auto shrink-0 p-0 text-xs font-medium text-primary hover:underline",
  iconWrapClassName = "shrink-0 rounded-md p-1.5",
}: SupervisorThreeDayOutlookProps) {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const { user, userRole } = useAuth();
  const { getDivisionFilter, userDivisionsKey } = usePermissions();
  const navigate = useNavigate();

  const [items, setItems] = useState<PersonOutlookItem[]>([]);
  const [scopeLabel, setScopeLabel] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!currentCompany?.id) {
        setItems([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const divisionFilter = getDivisionFilter();
        const scope = await resolveSupervisorOutlookScope(supabase, {
          userId: user?.id ?? null,
          userRole: userRole ?? null,
          companyId: currentCompany.id,
          divisionFilter,
        });

        const data = await fetchSupervisorScheduleOutlook(supabase, {
          companyId: currentCompany.id,
          season: currentSeason,
          divisionIds: scope.divisionIds,
          sportTypes: scope.sportTypes,
        });

        if (!cancelled) {
          setItems(data);
          setScopeLabel(scope.scopeLabel);
        }
      } catch (error) {
        console.error("[SupervisorThreeDayOutlook] Failed to load:", error);
        if (!cancelled) {
          setItems([]);
          setScopeLabel("");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [currentCompany?.id, currentSeason, user?.id, userRole, userDivisionsKey]);

  const days = useMemo(() => groupOutlookItemsByDate(items), [items]);

  const handleItemClick = (item: PersonOutlookItem) => {
    if (item.kind === "trip") navigate("/transportation");
    else if (item.kind === "sport") navigate("/athletics");
    else navigate("/activities-field-trips");
  };

  return (
    <Card className={`shadow-card ${className ?? ""}`}>
      <CardHeader className={headerClassName}>
        <div className="flex min-w-0 items-center gap-2">
          <div className={`${iconWrapClassName} bg-primary/10`}>
            <CalendarDays className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <CardTitle className={titleClassName}>Three Day Outlook</CardTitle>
            {scopeLabel ? (
              <p className="truncate text-xs text-muted-foreground">{scopeLabel}</p>
            ) : null}
          </div>
        </div>
        <Button variant="link" className={linkClassName} onClick={() => navigate("/master-calendar")}>
          View calendar
        </Button>
      </CardHeader>
      <CardContent className={`${contentClassName} space-y-2`}>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing scheduled in the next 3 days.</p>
        ) : (
          <div className="max-h-64 space-y-3 overflow-y-auto pr-1">
            {days.map((dayItems) => {
              const dateKey = dayItems[0]?.date;
              if (!dateKey) return null;
              return (
                <div key={dateKey} className="space-y-1.5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {outlookDayHeading(dateKey)}
                  </p>
                  {dayItems.map((item) => {
                    const KindIcon = KIND_ICON[item.kind];
                    return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => handleItemClick(item)}
                      className="flex w-full items-start gap-2 rounded-lg bg-muted/50 p-2 text-left transition-colors hover:bg-muted"
                    >
                      <KindIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{item.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {[
                            item.time ? formatTime12Hour(item.time) || item.time : null,
                            item.location,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <Badge variant="outline" className="shrink-0 text-[10px]">
                        {KIND_LABEL[item.kind]}
                      </Badge>
                    </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
