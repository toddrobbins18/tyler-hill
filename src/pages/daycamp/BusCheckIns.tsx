import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Bus, Clock, Download, FileText, Fuel, Moon, Sun } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCampOperationalDate } from "@/hooks/useCampOperationalDate";
import { useFilteredBusRoutes } from "@/hooks/useFilteredBusRoutes";
import {
  isRouteBusSubmitted,
  loadBusAttendance,
  type BusSubmissionsMap,
} from "@/lib/transportBusAttendance";
import {
  buildBusArrivalReportCsvRows,
  buildBusArrivalReportRows,
  busCheckinKey,
  formatCheckinTime,
  loadBusCheckins,
  saveBusCheckins,
  type BusCheckinMap,
} from "@/lib/transportBusCheckins";
import { FrontOfficeBackLink } from "@/components/daycamp/FrontOfficeBackLink";

function downloadCsv(rows: (string | number)[][], filename: string) {
  const csv = rows
    .map((row) =>
      row
        .map((cell) => {
          const s = String(cell ?? "");
          return s.includes(",") || s.includes('"') || s.includes("\n")
            ? `"${s.replace(/"/g, '""')}"`
            : s;
        })
        .join(","),
    )
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function BusCheckIns() {
  const { toast } = useToast();
  const { operationalDateString } = useCampOperationalDate();
  const [runDate, setRunDate] = useState(operationalDateString);
  const [timeOfDay, setTimeOfDay] = useState<"am" | "pm">("am");
  const [activeTab, setActiveTab] = useState("checkins");
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

  const toggleNeedsGas = (routeId: number, busLabel: string) => {
    const key = busCheckinKey(routeId);
    const now = new Date().toISOString();
    void supabase.auth.getUser().then(({ data: userRes }) => {
      setBusCheckins((prev) => {
        const current = prev[key];
        const nextFlag = !current?.needsGas;
        return {
          ...prev,
          [key]: {
            ...current,
            needsGas: nextFlag,
            needsGasAt: nextFlag ? now : null,
            needsGasBy: nextFlag ? userRes.user?.id ?? null : null,
          },
        };
      });
    });
    const turningOn = !busCheckins[key]?.needsGas;
    toast({
      title: turningOn ? "Needs gas flagged" : "Needs gas cleared",
      description: busLabel,
    });
  };

  const reportRows = useMemo(
    () => buildBusArrivalReportRows(routes, busCheckins),
    [routes, busCheckins],
  );

  const arrivedCount = reportRows.filter((r) => r.arrivedAt).length;
  const needsGasCount = reportRows.filter((r) => r.needsGas).length;

  const handleDownloadReport = () => {
    const rows = buildBusArrivalReportCsvRows(routes, busCheckins, {
      date: runDate,
      runPeriod: timeOfDay,
    });
    downloadCsv(rows, `bus-arrival-report-${runDate}-${timeOfDay}.csv`);
  };

  const weekNote = enrollmentCtx?.weekLabel
    ? `${enrollmentCtx.weekLabel}${enrollmentCtx.weekDateRange ? ` · ${enrollmentCtx.weekDateRange}` : ""}`
    : null;

  const dateRunToolbar = (
    <div className="flex flex-wrap items-center gap-2">
      <Label htmlFor="bus-checkin-date" className="text-xs text-muted-foreground whitespace-nowrap">
        Run date
      </Label>
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
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
      <FrontOfficeBackLink />
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="page-header flex items-center gap-2">
            <Clock className="h-6 w-6" /> Bus Check-ins
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Mark bus arrived, ready to depart, and needs gas — separate from camper Present/Absent attendance.
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Camper attendance:{" "}
            <Link to="/day-camp/bus-attendance" className="text-primary underline-offset-2 hover:underline">
              Bus Attendance
            </Link>
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="checkins" className="text-xs gap-1">
            <Bus className="h-3.5 w-3.5" /> Check-ins
          </TabsTrigger>
          <TabsTrigger value="report" className="text-xs gap-1">
            <FileText className="h-3.5 w-3.5" /> Arrival report
          </TabsTrigger>
        </TabsList>

        <TabsContent value="checkins" className="mt-4 space-y-4">
          {dateRunToolbar}
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
                  <p className="text-[10px] text-muted-foreground truncate">{r.name}</p>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {rec?.arrivedAt ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Arrived {formatCheckinTime(rec.arrivedAt)}
                      </Badge>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 text-[10px]"
                        onClick={() => markBusArrived(r.id)}
                        disabled={checkinsLoading}
                      >
                        Mark arrived
                      </Button>
                    )}
                    {rec?.departedAt ? (
                      <Badge variant="secondary" className="text-[10px]">
                        Departed {formatCheckinTime(rec.departedAt)}
                      </Badge>
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
                  <Button
                    type="button"
                    size="sm"
                    variant={rec?.needsGas ? "default" : "outline"}
                    className={`h-7 text-[10px] w-full gap-1 ${
                      rec?.needsGas ? "bg-amber-600 hover:bg-amber-700 text-white" : ""
                    }`}
                    onClick={() => toggleNeedsGas(r.id, r.bus)}
                    disabled={checkinsLoading}
                  >
                    <Fuel className="h-3 w-3" />
                    {rec?.needsGas
                      ? `Needs gas · ${rec.needsGasAt ? formatCheckinTime(rec.needsGasAt) : "flagged"}`
                      : "Needs gas"}
                  </Button>
                </div>
              );
            })}
          </div>
          {!boardLoading && !routes.length && (
            <p className="text-sm text-muted-foreground">No buses available for this date and run.</p>
          )}
        </TabsContent>

        <TabsContent value="report" className="mt-4 space-y-4">
          {dateRunToolbar}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <CardTitle className="text-base">Bus arrival report</CardTitle>
                  <CardDescription>
                    {runDate} · {timeOfDay.toUpperCase()} · {arrivedCount}/{routes.length} arrived
                    {needsGasCount > 0 ? ` · ${needsGasCount} need gas` : ""}
                  </CardDescription>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1.5 shrink-0"
                  onClick={handleDownloadReport}
                  disabled={!routes.length}
                >
                  <Download className="h-3.5 w-3.5" />
                  Download CSV
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0 pb-4">
              {!routes.length ? (
                <p className="text-sm text-muted-foreground px-6">No buses for this date and run.</p>
              ) : (
                <div className="overflow-x-auto border-t">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/40">
                      <tr className="text-left text-xs text-muted-foreground">
                        <th className="font-medium p-3">Bus</th>
                        <th className="font-medium p-3 hidden sm:table-cell">Route</th>
                        <th className="font-medium p-3">Arrived</th>
                        <th className="font-medium p-3">Ready to depart</th>
                        <th className="font-medium p-3">Needs gas</th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportRows.map((row) => (
                        <tr key={`${row.bus}-${row.routeName}`} className="border-t border-border/60">
                          <td className="p-3 font-medium">{row.bus}</td>
                          <td className="p-3 text-muted-foreground hidden sm:table-cell">{row.routeName}</td>
                          <td className="p-3">
                            {row.arrivedAt ? (
                              formatCheckinTime(row.arrivedAt)
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3">
                            {row.departedAt ? (
                              formatCheckinTime(row.departedAt)
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3">
                            {row.needsGas ? (
                              <Badge variant="outline" className="border-amber-500/50 text-amber-800 dark:text-amber-200">
                                Yes{row.needsGasAt ? ` · ${formatCheckinTime(row.needsGasAt)}` : ""}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}
