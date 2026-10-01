import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Bus, Clock, Moon, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCampOperationalDate } from "@/hooks/useCampOperationalDate";
import { useFilteredBusRoutes } from "@/hooks/useFilteredBusRoutes";
import {
  isRouteBusSubmitted,
  loadBusAttendance,
  type BusSubmissionsMap,
} from "@/lib/transportBusAttendance";
import {
  busCheckinKey,
  formatCheckinTime,
  loadBusCheckins,
  saveBusCheckins,
  type BusCheckinMap,
} from "@/lib/transportBusCheckins";
import { FrontOfficeBackLink } from "@/components/daycamp/FrontOfficeBackLink";

export default function BusCheckIns() {
  const { toast } = useToast();
  const { operationalDateString } = useCampOperationalDate();
  const [runDate, setRunDate] = useState(operationalDateString);
  const [timeOfDay, setTimeOfDay] = useState<"am" | "pm">("am");
  const [busCheckins, setBusCheckins] = useState<BusCheckinMap>({});
  const [busSubmissions, setBusSubmissions] = useState<BusSubmissionsMap>({});
  const [checkinsLoading, setCheckinsLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const skipCheckinsPersistRef = useRef(true);

  useEffect(() => {
    setRunDate(operationalDateString);
  }, [operationalDateString]);

  const {
    companyId,
    currentSeason,
    boardLoading,
    routes,
    enrollmentCtx,
    busScopeLabel,
  } = useFilteredBusRoutes(runDate, timeOfDay);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    skipCheckinsPersistRef.current = true;
    setCheckinsLoading(true);
    void (async () => {
      try {
        const [checkins, attendance] = await Promise.all([
          loadBusCheckins(supabase, companyId, currentSeason, runDate, timeOfDay),
          loadBusAttendance(supabase, companyId, currentSeason, runDate, timeOfDay),
        ]);
        if (cancelled) return;
        setBusCheckins(checkins);
        setBusSubmissions(attendance.busSubmissions);
      } catch (err) {
        console.error("[BusCheckIns] Load error:", err);
      } finally {
        if (!cancelled) {
          skipCheckinsPersistRef.current = false;
          setCheckinsLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [companyId, currentSeason, runDate, timeOfDay]);

  useEffect(() => {
    if (!companyId || skipCheckinsPersistRef.current || checkinsLoading) return;
    setSaveState("saving");
    const handle = setTimeout(() => {
      void (async () => {
        const { data: userRes } = await supabase.auth.getUser();
        const ok = await saveBusCheckins(
          supabase,
          companyId,
          currentSeason,
          runDate,
          timeOfDay,
          busCheckins,
          userRes.user?.id,
        );
        setSaveState(ok ? "saved" : "idle");
        if (ok) {
          const t = setTimeout(() => setSaveState("idle"), 2000);
          return () => clearTimeout(t);
        }
      })();
    }, 300);
    return () => clearTimeout(handle);
  }, [busCheckins, companyId, currentSeason, runDate, timeOfDay, checkinsLoading]);

  const markBusArrived = (routeId: number) => {
    const key = busCheckinKey(routeId);
    const now = new Date().toISOString();
    void supabase.auth.getUser().then(({ data: userRes }) => {
      setBusCheckins((prev) => ({
        ...prev,
        [key]: { ...prev[key], arrivedAt: now, arrivedBy: userRes.user?.id ?? null },
      }));
    });
    toast({ title: "Bus marked arrived", description: formatCheckinTime(now) });
  };

  const markBusReadyToDepart = (routeId: number, busLabel: string) => {
    if (!isRouteBusSubmitted(routeId, busSubmissions)) {
      toast({
        title: "Camper attendance not submitted",
        description: `Submit camper attendance for ${busLabel} on the Bus Attendance page first.`,
        variant: "destructive",
      });
      return;
    }
    const key = busCheckinKey(routeId);
    if (!busCheckins[key]?.arrivedAt) {
      toast({
        title: "Mark bus arrived first",
        description: `${busLabel} must be checked in before ready to depart.`,
        variant: "destructive",
      });
      return;
    }
    const now = new Date().toISOString();
    void supabase.auth.getUser().then(({ data: userRes }) => {
      setBusCheckins((prev) => ({
        ...prev,
        [key]: { ...prev[key], departedAt: now, departedBy: userRes.user?.id ?? null },
      }));
    });
    toast({ title: "Bus ready to depart", description: `${busLabel} · ${formatCheckinTime(now)}` });
  };

  const weekNote = enrollmentCtx?.weekLabel
    ? `${enrollmentCtx.weekLabel}${enrollmentCtx.weekDateRange ? ` · ${enrollmentCtx.weekDateRange}` : ""}`
    : null;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <FrontOfficeBackLink />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-header flex items-center gap-2">
            <Clock className="h-6 w-6" /> Bus Check-ins
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mark bus arrived and ready to depart — separate from camper Present/Absent attendance.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Camper attendance:{" "}
            <Link to="/day-camp/bus-attendance" className="text-primary underline-offset-2 hover:underline">
              Bus Attendance
            </Link>
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="bus-checkin-date" className="text-xs text-muted-foreground whitespace-nowrap">Run date</Label>
        <Input
          id="bus-checkin-date"
          type="date"
          value={runDate}
          onChange={(e) => setRunDate(e.target.value || operationalDateString)}
          className="h-8 w-[140px] text-xs"
        />
        {runDate === operationalDateString && (
          <Badge variant="secondary" className="text-[10px]">Today</Badge>
        )}
        <div className="inline-flex rounded-lg border border-border bg-muted/30 p-0.5">
          <button
            type="button"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              timeOfDay === "am" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
            }`}
            onClick={() => setTimeOfDay("am")}
          >
            <Sun className="h-3.5 w-3.5" /> AM
          </button>
          <button
            type="button"
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
              timeOfDay === "pm" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground"
            }`}
            onClick={() => setTimeOfDay("pm")}
          >
            <Moon className="h-3.5 w-3.5" /> PM
          </button>
        </div>
        {(boardLoading || checkinsLoading) && (
          <span className="text-[10px] text-muted-foreground">Loading…</span>
        )}
        {saveState === "saving" && (
          <Badge variant="outline" className="text-[10px] ml-auto">Saving…</Badge>
        )}
        {saveState === "saved" && (
          <Badge variant="secondary" className="text-[10px] ml-auto">Saved</Badge>
        )}
        {busScopeLabel && (
          <Badge variant="outline" className="text-[10px]">{busScopeLabel} only</Badge>
        )}
        {weekNote && (
          <Badge variant="outline" className="text-[10px]">{weekNote}</Badge>
        )}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {routes.map((r) => {
          const rec = busCheckins[busCheckinKey(r.id)];
          const submitted = isRouteBusSubmitted(r.id, busSubmissions);
          return (
            <div key={r.id} className="rounded-md border border-border bg-background px-3 py-2.5 text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-medium">
                <Bus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                {r.bus}
                {submitted ? (
                  <Badge variant="secondary" className="text-[9px] ml-auto">Attendance submitted</Badge>
                ) : (
                  <Badge variant="outline" className="text-[9px] ml-auto">Attendance pending</Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                {rec?.arrivedAt ? (
                  <Badge variant="secondary" className="text-[10px]">Arrived {formatCheckinTime(rec.arrivedAt)}</Badge>
                ) : (
                  <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => markBusArrived(r.id)} disabled={checkinsLoading}>
                    Mark arrived
                  </Button>
                )}
                {rec?.departedAt ? (
                  <Badge variant="secondary" className="text-[10px]">Departed {formatCheckinTime(rec.departedAt)}</Badge>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    className="h-7 text-[10px]"
                    onClick={() => markBusReadyToDepart(r.id, r.bus)}
                    disabled={checkinsLoading || !rec?.arrivedAt || !submitted}
                  >
                    Ready to depart
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {!boardLoading && !routes.length && (
        <p className="text-sm text-muted-foreground">No buses available for this date and run.</p>
      )}
    </motion.div>
  );
}
