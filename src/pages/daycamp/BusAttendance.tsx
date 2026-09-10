import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Bus, ClipboardList, Clock, Moon, Printer, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeason } from "@/contexts/SeasonContext";
import { campTodayDateString } from "@/lib/parentPortalCutoff";
import {
  allRoutesBusSubmitted,
  busSubmissionKey,
  campersOnRoute,
  isRouteBusSubmitted,
  loadBusAttendance,
  saveBusAttendance,
  type BusAttendanceMap,
  type BusAttendanceStatus,
  type BusSubmissionsMap,
} from "@/lib/transportBusAttendance";
import {
  busCheckinKey,
  formatCheckinTime,
  loadBusCheckins,
  saveBusCheckins,
  type BusCheckinMap,
} from "@/lib/transportBusCheckins";
import { buildBusBubbleSheetsPdf } from "@/lib/transportBubbleSheetPdf";
import { buildRunRoutes, getEffectiveCoreStops, loadTransportRunBoard, type TransportRunBoard } from "@/lib/transportRunBoard";
import { TransportReportPreviewDialog, type TransportReportPreview } from "@/components/TransportReportPreviewDialog";

export default function BusAttendance() {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeason();
  const companyId = currentCompany?.id;

  const [runDate, setRunDate] = useState(campTodayDateString());
  const [timeOfDay, setTimeOfDay] = useState<"am" | "pm">("am");
  const [board, setBoard] = useState<TransportRunBoard | null>(null);
  const [boardLoading, setBoardLoading] = useState(true);
  const [busAttendance, setBusAttendance] = useState<BusAttendanceMap>({});
  const [busSubmissions, setBusSubmissions] = useState<BusSubmissionsMap>({});
  const [attendanceSubmittedAt, setAttendanceSubmittedAt] = useState<string | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [busCheckins, setBusCheckins] = useState<BusCheckinMap>({});
  const [checkinsLoading, setCheckinsLoading] = useState(true);
  const [reportPreview, setReportPreview] = useState<TransportReportPreview | null>(null);
  const skipAttendancePersistRef = useRef(true);
  const skipCheckinsPersistRef = useRef(true);

  const routes = useMemo(
    () => (board ? buildRunRoutes(board, timeOfDay) : []),
    [board, timeOfDay],
  );

  const routeIdsWithRoster = useMemo(() => routes.map((r) => r.id), [routes]);

  const allBusesSubmitted = useMemo(
    () => allRoutesBusSubmitted(routeIdsWithRoster, busSubmissions),
    [routeIdsWithRoster, busSubmissions],
  );

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    setBoardLoading(true);
    void (async () => {
      try {
        const loaded = await loadTransportRunBoard(supabase, companyId, currentSeason, runDate);
        if (!cancelled) setBoard(loaded);
      } catch (err) {
        console.error("[BusAttendance] Load board error:", err);
      } finally {
        if (!cancelled) setBoardLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [companyId, currentSeason, runDate]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    skipAttendancePersistRef.current = true;
    setAttendanceLoading(true);
    void (async () => {
      try {
        const loaded = await loadBusAttendance(supabase, companyId, currentSeason, runDate, timeOfDay);
        if (cancelled) return;
        setBusAttendance(loaded.records);
        setBusSubmissions(loaded.busSubmissions);
        setAttendanceSubmittedAt(loaded.submittedAt);
      } catch (err) {
        console.error("[BusAttendance] Load attendance error:", err);
      } finally {
        if (!cancelled) {
          skipAttendancePersistRef.current = false;
          setAttendanceLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [companyId, currentSeason, runDate, timeOfDay]);

  useEffect(() => {
    if (!companyId) return;
    let cancelled = false;
    skipCheckinsPersistRef.current = true;
    setCheckinsLoading(true);
    void (async () => {
      try {
        const loaded = await loadBusCheckins(supabase, companyId, currentSeason, runDate, timeOfDay);
        if (!cancelled) setBusCheckins(loaded);
      } catch (err) {
        console.error("[BusAttendance] Load check-ins error:", err);
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
    if (!companyId || skipAttendancePersistRef.current || attendanceLoading) return;
    const handle = setTimeout(() => {
      void (async () => {
        const { data: userRes } = await supabase.auth.getUser();
        await saveBusAttendance(
          supabase,
          companyId,
          currentSeason,
          runDate,
          timeOfDay,
          busAttendance,
          {
            busSubmissions,
            allRoutesSubmitted: allBusesSubmitted,
            userId: userRes.user?.id,
          },
        );
      })();
    }, 600);
    return () => clearTimeout(handle);
  }, [busAttendance, busSubmissions, allBusesSubmitted, companyId, currentSeason, runDate, timeOfDay, attendanceLoading]);

  useEffect(() => {
    if (!companyId || skipCheckinsPersistRef.current || checkinsLoading) return;
    const handle = setTimeout(() => {
      void (async () => {
        const { data: userRes } = await supabase.auth.getUser();
        await saveBusCheckins(supabase, companyId, currentSeason, runDate, timeOfDay, busCheckins, userRes.user?.id);
      })();
    }, 600);
    return () => clearTimeout(handle);
  }, [busCheckins, companyId, currentSeason, runDate, timeOfDay, checkinsLoading]);

  const setCamperAttendance = (routeId: number, key: string, status: BusAttendanceStatus) => {
    setBusAttendance((prev) => ({ ...prev, [key]: status }));
    setBusSubmissions((prev) => {
      const next = { ...prev };
      delete next[busSubmissionKey(routeId)];
      return next;
    });
    setAttendanceSubmittedAt(null);
  };

  const markBusPresent = (routeId: number, keys: string[]) => {
    setBusAttendance((prev) => {
      const next = { ...prev };
      for (const key of keys) next[key] = "present";
      return next;
    });
    setBusSubmissions((prev) => {
      const next = { ...prev };
      delete next[busSubmissionKey(routeId)];
      return next;
    });
    setAttendanceSubmittedAt(null);
  };

  const handleSubmitBus = async (routeId: number, busLabel: string) => {
    if (!companyId || !board) return;
    const core = getEffectiveCoreStops(board, routeId, timeOfDay);
    const campers = campersOnRoute(routeId, core);
    if (!campers.length) return;

    const { data: userRes } = await supabase.auth.getUser();
    const nextSubmissions = {
      ...busSubmissions,
      [busSubmissionKey(routeId)]: {
        submittedAt: new Date().toISOString(),
        submittedBy: userRes.user?.id ?? null,
      },
    };
    const allDone = allRoutesBusSubmitted(routeIdsWithRoster, nextSubmissions);

    const ok = await saveBusAttendance(
      supabase,
      companyId,
      currentSeason,
      runDate,
      timeOfDay,
      busAttendance,
      {
        busSubmissions: nextSubmissions,
        submittedRouteId: routeId,
        allRoutesSubmitted: allDone,
        userId: userRes.user?.id,
      },
    );

    if (!ok) {
      toast({ title: "Could not submit attendance", variant: "destructive" });
      return;
    }

    setBusSubmissions(nextSubmissions);
    if (allDone) setAttendanceSubmittedAt(new Date().toISOString());

    let present = 0;
    let absent = 0;
    for (const c of campers) {
      if (busAttendance[c.key] === "present") present++;
      else if (busAttendance[c.key] === "absent") absent++;
    }

    toast({
      title: `${busLabel} submitted`,
      description: `${present} present · ${absent} absent · ${campers.length - present - absent} unmarked`,
    });
  };

  const markBusArrived = async (routeId: number) => {
    const key = busCheckinKey(routeId);
    const now = new Date().toISOString();
    const { data: userRes } = await supabase.auth.getUser();
    setBusCheckins((prev) => ({
      ...prev,
      [key]: { ...prev[key], arrivedAt: now, arrivedBy: userRes.user?.id ?? null },
    }));
    toast({ title: "Bus marked arrived", description: formatCheckinTime(now) });
  };

  const markBusReadyToDepart = async (routeId: number, busLabel: string) => {
    if (!isRouteBusSubmitted(routeId, busSubmissions)) {
      toast({
        title: "Submit this bus first",
        description: `Mark attendance for ${busLabel}, then submit before departing.`,
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
    const { data: userRes } = await supabase.auth.getUser();
    setBusCheckins((prev) => ({
      ...prev,
      [key]: { ...prev[key], departedAt: now, departedBy: userRes.user?.id ?? null },
    }));
    toast({ title: "Bus ready to depart", description: `${busLabel} · ${formatCheckinTime(now)}` });
  };

  const handleBubbleSheet = useCallback(() => {
    if (!board) return;
    const sheetRoutes = routes.map((r) => ({
      bus: r.bus,
      routeName: r.name,
      campers: campersOnRoute(r.id, getEffectiveCoreStops(board, r.id, timeOfDay)).map((c) => ({
        name: c.name,
        detail: c.stopName,
      })),
    }));

    const built = buildBusBubbleSheetsPdf({
      companyName: currentCompany?.name ?? "Day Camp",
      date: runDate,
      runPeriod: timeOfDay,
      routes: sheetRoutes,
    });
    if (!built) {
      toast({ title: "No campers to print", variant: "destructive" });
      return;
    }
    setReportPreview({
      open: true,
      title: "Bus Attendance Bubble Sheet",
      description: `${runDate} · ${timeOfDay.toUpperCase()} run`,
      kind: "pdf",
      blob: built.blob,
      filename: built.filename,
    });
  }, [board, routes, currentCompany?.name, runDate, timeOfDay, toast]);

  const submittedCount = routes.filter((r) => isRouteBusSubmitted(r.id, busSubmissions)).length;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-header flex items-center gap-2">
            <ClipboardList className="h-6 w-6" /> Bus Attendance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Take attendance by bus — no route editing. Submit each bus when done.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="gap-1.5" onClick={handleBubbleSheet} disabled={!routes.length}>
          <Printer className="h-3.5 w-3.5" /> Bubble sheet
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="bus-attendance-date" className="text-xs text-muted-foreground whitespace-nowrap">Run date</Label>
        <Input
          id="bus-attendance-date"
          type="date"
          value={runDate}
          onChange={(e) => setRunDate(e.target.value || campTodayDateString())}
          className="h-8 w-[140px] text-xs"
        />
        {runDate === campTodayDateString() && (
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
        {(boardLoading || attendanceLoading) && (
          <span className="text-[10px] text-muted-foreground">Loading…</span>
        )}
        <Badge variant="outline" className="text-[10px] ml-auto">
          {submittedCount} / {routes.length} buses submitted
        </Badge>
        {allBusesSubmitted && attendanceSubmittedAt && (
          <Badge variant="secondary" className="text-[10px]">All buses submitted</Badge>
        )}
      </div>

      {board && board.transportExceptions.length > 0 && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2">
          <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">Today&apos;s exceptions</p>
          <ul className="text-[11px] text-muted-foreground space-y-0.5 max-h-20 overflow-y-auto">
            {board.transportExceptions.map((ex, i) => (
              <li key={`${ex.source}-${ex.camperName}-${i}`}>
                <span className="font-medium text-foreground">{ex.camperName}</span>
                {" · "}{ex.label}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="rounded-lg border border-border bg-muted/20 p-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Bus check-in / check-out
            </h3>
            <p className="text-[11px] text-muted-foreground">Per bus — submit attendance before ready to depart.</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {routes.map((r) => {
            const rec = busCheckins[busCheckinKey(r.id)];
            const submitted = isRouteBusSubmitted(r.id, busSubmissions);
            return (
              <div key={`checkin-${r.id}`} className="rounded-md border border-border bg-background px-2.5 py-2 text-xs space-y-1.5">
                <div className="flex items-center gap-1.5 font-medium">
                  <Bus className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  {r.bus}
                  {submitted && <Badge variant="secondary" className="text-[9px] ml-auto">Submitted</Badge>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {rec?.arrivedAt ? (
                    <Badge variant="secondary" className="text-[10px]">Arrived {formatCheckinTime(rec.arrivedAt)}</Badge>
                  ) : (
                    <Button type="button" size="sm" variant="outline" className="h-7 text-[10px]" onClick={() => void markBusArrived(r.id)} disabled={checkinsLoading}>
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
                      onClick={() => void markBusReadyToDepart(r.id, r.bus)}
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
      </div>

      <div className="grid gap-4">
        {routes.map((r) => {
          if (!board) return null;
          const core = getEffectiveCoreStops(board, r.id, timeOfDay);
          const campers = campersOnRoute(r.id, core);
          const submitted = isRouteBusSubmitted(r.id, busSubmissions);
          let present = 0;
          let absent = 0;
          for (const c of campers) {
            if (busAttendance[c.key] === "present") present++;
            else if (busAttendance[c.key] === "absent") absent++;
          }

          return (
            <Card key={r.id}>
              <CardHeader className="pb-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.color }} />
                      {r.bus}
                    </CardTitle>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{r.name} · {campers.length} campers</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{present} P</Badge>
                    <Badge variant="outline" className="text-[10px]">{absent} A</Badge>
                    {submitted ? (
                      <Badge variant="secondary" className="text-[10px]">Submitted</Badge>
                    ) : (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs"
                          onClick={() => markBusPresent(r.id, campers.map((c) => c.key))}
                          disabled={!campers.length}
                        >
                          Mark all present
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 text-xs"
                          onClick={() => void handleSubmitBus(r.id, r.bus)}
                          disabled={!campers.length || attendanceLoading}
                        >
                          Submit {r.bus}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {campers.map((c) => {
                    const status = busAttendance[c.key];
                    return (
                      <div key={c.key} className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1.5 text-xs">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{c.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{c.stopName}</p>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            type="button"
                            size="sm"
                            variant={status === "present" ? "default" : "outline"}
                            className="h-7 px-2 text-[10px]"
                            onClick={() => setCamperAttendance(r.id, c.key, "present")}
                            disabled={submitted}
                          >
                            P
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={status === "absent" ? "destructive" : "outline"}
                            className="h-7 px-2 text-[10px]"
                            onClick={() => setCamperAttendance(r.id, c.key, "absent")}
                            disabled={submitted}
                          >
                            A
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {!boardLoading && !routes.length && (
        <p className="text-sm text-muted-foreground">No campers scheduled on buses for this date and run.</p>
      )}

      <TransportReportPreviewDialog
        preview={reportPreview}
        onOpenChange={(open) => { if (!open) setReportPreview(null); }}
      />
    </motion.div>
  );
}
