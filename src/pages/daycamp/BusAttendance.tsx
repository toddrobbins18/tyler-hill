import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, Moon, Printer, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useCampOperationalDate } from "@/hooks/useCampOperationalDate";
import { useFilteredBusRoutes } from "@/hooks/useFilteredBusRoutes";
import {
  allRoutesBusSubmitted,
  busSubmissionKey,
  isRouteBusSubmitted,
  loadBusAttendance,
  saveBusAttendance,
  type BusAttendanceMap,
  type BusAttendanceStatus,
  type BusSubmissionsMap,
} from "@/lib/transportBusAttendance";
import { campersOnRouteForWeek, weekContextForNumber } from "@/lib/transportBusRunContext";
import { formatEnrollmentWeekLabel } from "@/lib/enrollmentWeekCalendar";
import { buildBusBubbleSheetsPdf } from "@/lib/transportBubbleSheetPdf";
import { getEffectiveCoreStops } from "@/lib/transportRunBoard";
import { TransportReportPreviewDialog, type TransportReportPreview } from "@/components/TransportReportPreviewDialog";
import { FrontOfficeBackLink } from "@/components/daycamp/FrontOfficeBackLink";

export default function BusAttendance() {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const { operationalDateString } = useCampOperationalDate();
  const [runDate, setRunDate] = useState(operationalDateString);
  const [timeOfDay, setTimeOfDay] = useState<"am" | "pm">("am");
  const [busAttendance, setBusAttendance] = useState<BusAttendanceMap>({});
  const [busSubmissions, setBusSubmissions] = useState<BusSubmissionsMap>({});
  const [attendanceSubmittedAt, setAttendanceSubmittedAt] = useState<string | null>(null);
  const [attendanceLoading, setAttendanceLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [reportPreview, setReportPreview] = useState<TransportReportPreview | null>(null);
  const [selectedRouteIds, setSelectedRouteIds] = useState<number[]>([]);
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);
  const skipAttendancePersistRef = useRef(true);

  useEffect(() => {
    setRunDate(operationalDateString);
  }, [operationalDateString]);

  const {
    companyId,
    currentSeason,
    board,
    boardLoading,
    routes,
    enrollmentCtx,
    busScopeLabel,
  } = useFilteredBusRoutes(runDate, timeOfDay);

  const routeIdsWithRoster = useMemo(() => routes.map((r) => r.id), [routes]);
  const routeIdsKey = routeIdsWithRoster.join(",");

  useEffect(() => {
    setSelectedRouteIds(routeIdsWithRoster);
  }, [routeIdsKey, routeIdsWithRoster]);

  useEffect(() => {
    if (!enrollmentCtx?.defaultWeek) return;
    setSelectedWeek(enrollmentCtx.defaultWeek);
  }, [enrollmentCtx?.defaultWeek, runDate]);

  const activeWeek = selectedWeek ?? enrollmentCtx?.defaultWeek ?? null;
  const activeWeekContext = useMemo(() => {
    if (!enrollmentCtx || activeWeek == null) return null;
    return weekContextForNumber(enrollmentCtx.calendar, activeWeek);
  }, [enrollmentCtx, activeWeek]);

  const selectedRoutes = useMemo(
    () => routes.filter((r) => selectedRouteIds.includes(r.id)),
    [routes, selectedRouteIds],
  );

  const toggleBubbleSheetRoute = (routeId: number) => {
    setSelectedRouteIds((prev) =>
      prev.includes(routeId) ? prev.filter((id) => id !== routeId) : [...prev, routeId],
    );
  };

  const allBusesSubmitted = useMemo(
    () => allRoutesBusSubmitted(routeIdsWithRoster, busSubmissions),
    [routeIdsWithRoster, busSubmissions],
  );

  const campersForRoute = useCallback(
    (routeId: number) => {
      if (!board || !enrollmentCtx) return [];
      const core = getEffectiveCoreStops(board, routeId, timeOfDay);
      return campersOnRouteForWeek(
        routeId,
        core,
        activeWeek,
        enrollmentCtx.enrollmentLookup,
      );
    },
    [board, enrollmentCtx, timeOfDay, activeWeek],
  );

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
    if (!companyId || skipAttendancePersistRef.current || attendanceLoading) return;
    setSaveState("saving");
    const handle = setTimeout(() => {
      void (async () => {
        const { data: userRes } = await supabase.auth.getUser();
        const ok = await saveBusAttendance(
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
        setSaveState(ok ? "saved" : "idle");
      })();
    }, 300);
    return () => clearTimeout(handle);
  }, [busAttendance, busSubmissions, allBusesSubmitted, companyId, currentSeason, runDate, timeOfDay, attendanceLoading]);

  useEffect(() => {
    if (saveState !== "saved") return;
    const t = setTimeout(() => setSaveState("idle"), 2000);
    return () => clearTimeout(t);
  }, [saveState]);

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
    const campers = campersForRoute(routeId);
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

  const handleBubbleSheet = useCallback(() => {
    if (!board || !selectedRoutes.length) {
      toast({ title: "No buses selected", variant: "destructive" });
      return;
    }
    if (activeWeek == null || !activeWeekContext) {
      toast({
        title: "Enrollment week calendar required",
        description: "Set week start/end dates under Group Bubble Sheets, then pick a week above.",
        variant: "destructive",
      });
      return;
    }

    const sheetRoutes = selectedRoutes.map((r) => ({
      bus: r.bus,
      routeName: r.name,
      campers: campersForRoute(r.id).map((c) => ({
        name: c.name,
        detail: c.stopName,
      })),
    }));

    const built = buildBusBubbleSheetsPdf({
      companyName: currentCompany?.name ?? "Day Camp",
      enrollmentWeek: activeWeek,
      weekDateRange: activeWeekContext.weekDateRange ?? undefined,
      weekDays: activeWeekContext.weekDays,
      routes: sheetRoutes,
    });
    if (!built) {
      toast({ title: "No campers to print", variant: "destructive" });
      return;
    }
    const busLabel =
      selectedRoutes.length === routes.length
        ? "all buses"
        : selectedRoutes.map((r) => r.bus).join(", ");
    setReportPreview({
      open: true,
      title: "Bus Attendance Bubble Sheet (Weekly AM & PM)",
      description: `${activeWeekContext.weekLabel} · ${busLabel}`,
      kind: "pdf",
      blob: built.blob,
      filename: built.filename,
    });
  }, [board, selectedRoutes, activeWeek, activeWeekContext, campersForRoute, routes.length, toast, currentCompany?.name]);

  const submittedCount = routes.filter((r) => isRouteBusSubmitted(r.id, busSubmissions)).length;
  const weekNote = activeWeekContext?.weekLabel ?? null;
  const runDateOutsideWeek =
    enrollmentCtx?.enrollmentWeek == null &&
    activeWeek != null &&
    enrollmentCtx?.configuredWeeks.length;

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <FrontOfficeBackLink />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-header flex items-center gap-2">
            <ClipboardList className="h-6 w-6" /> Bus Attendance
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mark Present / Absent per camper — each sibling on their own row. Saves live when you tap P or A.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Bus arrived / depart:{" "}
            <Link to="/day-camp/bus-check-ins" className="text-primary underline-offset-2 hover:underline">
              Bus Check-ins
            </Link>
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={handleBubbleSheet}
          disabled={!selectedRoutes.length}
        >
          <Printer className="h-3.5 w-3.5" /> Print weekly bubble sheet
        </Button>
      </div>

      {routes.length > 0 ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Bubble sheet buses</CardTitle>
            <CardDescription>Weekly PDF with AM and PM bubbles Mon–Fri (enrolled campers this week only).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" variant="outline" onClick={() => setSelectedRouteIds(routeIdsWithRoster)}>
                Select all
              </Button>
              <Button type="button" size="sm" variant="ghost" onClick={() => setSelectedRouteIds([])}>
                Clear
              </Button>
              <span className="text-xs text-muted-foreground self-center">
                {selectedRouteIds.length} of {routes.length} selected
              </span>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-2">
              {routes.map((r) => (
                <label
                  key={r.id}
                  className="flex items-center gap-2 cursor-pointer text-sm"
                  style={{ borderLeftColor: r.color, borderLeftWidth: 3, paddingLeft: 8 }}
                >
                  <Checkbox
                    checked={selectedRouteIds.includes(r.id)}
                    onCheckedChange={() => toggleBubbleSheetRoute(r.id)}
                  />
                  <span className="font-medium">{r.bus}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[140px]">{r.name}</span>
                </label>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="bus-attendance-date" className="text-xs text-muted-foreground whitespace-nowrap">Run date</Label>
        <Input
          id="bus-attendance-date"
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
        {(boardLoading || attendanceLoading) && (
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
        {enrollmentCtx && enrollmentCtx.configuredWeeks.length > 0 ? (
          <>
            <Label htmlFor="bus-attendance-week" className="text-xs text-muted-foreground whitespace-nowrap">
              Enrollment week
            </Label>
            <Select
              value={activeWeek != null ? String(activeWeek) : undefined}
              onValueChange={(v) => setSelectedWeek(Number(v))}
            >
              <SelectTrigger id="bus-attendance-week" className="h-8 w-[200px] text-xs">
                <SelectValue placeholder="Select week" />
              </SelectTrigger>
              <SelectContent>
                {enrollmentCtx.configuredWeeks.map((row) => (
                  <SelectItem key={row.weekNumber} value={String(row.weekNumber)} className="text-xs">
                    {formatEnrollmentWeekLabel(row.weekNumber, enrollmentCtx.calendar)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </>
        ) : null}
        {weekNote && (
          <Badge variant="outline" className="text-[10px]">Roster: {weekNote}</Badge>
        )}
        {runDateOutsideWeek ? (
          <Badge variant="secondary" className="text-[10px]">
            Run date outside week — using selected week for roster &amp; print
          </Badge>
        ) : null}
        <Badge variant="outline" className="text-[10px]">
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

      <div className="grid gap-4">
        {routes.map((r) => {
          if (!board) return null;
          const campers = campersForRoute(r.id);
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
                    <p className="text-[11px] text-muted-foreground mt-0.5">{r.name} · {campers.length} campers this week</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">{present} P</Badge>
                    <Badge variant="outline" className="text-[10px]">{absent} A</Badge>
                    {submitted && <Badge variant="secondary" className="text-[10px]">Submitted</Badge>}
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
                          >
                            P
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant={status === "absent" ? "destructive" : "outline"}
                            className="h-7 px-2 text-[10px]"
                            onClick={() => setCamperAttendance(r.id, c.key, "absent")}
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
