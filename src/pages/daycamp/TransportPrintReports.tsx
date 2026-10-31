import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bus, Download, FileText, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { FrontOfficeBackLink } from "@/components/daycamp/FrontOfficeBackLink";
import { TransportReportPreviewDialog, type TransportReportPreview } from "@/components/TransportReportPreviewDialog";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { triggerBlobDownload } from "@/lib/transportBubbleSheetPdf";
import type { TransportRouteMeta, TransportRouteStop } from "@/lib/transportRoster";
import { consolidateRouteStopsByAddress } from "@/lib/transportRouteStops";
import { getEffectiveCoreStops, loadTransportRunBoard, type TransportRunBoard } from "@/lib/transportRunBoard";
import { loadBusRunEnrollmentContext } from "@/lib/transportBusRunContext";
import { buildBusBubbleSheetRoutes } from "@/lib/transportCamperBusRun";
import {
  buildBusRouteSummaryPdf,
  buildBusRosterReportPdf,
  buildGroupReportPdf,
} from "@/lib/transportCampMinderReportsPdf";
import {
  buildRouteSummaryRows,
  childToGroupReportCamper,
  loadBusCounselorForRoute,
  loadTransportReportChildren,
  resolveCamperTransportLine,
} from "@/lib/transportReportData";
import {
  enrollmentWeekForDate,
  formatEnrollmentWeekLabel,
  formatEnrollmentWeekRange,
  loadEnrollmentWeekCalendar,
  resolveEnrollmentWeekRow,
} from "@/lib/enrollmentWeekCalendar";
import { todayDateString } from "@/lib/transportDailyOverrides";
import { useToast } from "@/hooks/use-toast";

export default function TransportPrintReports() {
  const { toast } = useToast();
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const companyId = currentCompany?.id;

  const [runDate, setRunDate] = useState(todayDateString());
  const [calendar, setCalendar] = useState<Awaited<ReturnType<typeof loadEnrollmentWeekCalendar>>>([]);
  const [board, setBoard] = useState<TransportRunBoard | null>(null);
  const [enrollmentLookup, setEnrollmentLookup] = useState<
    Map<string, import("@/lib/transportWeekView").CamperEnrollmentInfo> | undefined
  >(undefined);
  const [children, setChildren] = useState<Awaited<ReturnType<typeof loadTransportReportChildren>>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRouteIds, setSelectedRouteIds] = useState<number[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<TransportReportPreview | null>(null);

  const enrollmentWeek = useMemo(() => {
    const row = enrollmentWeekForDate(runDate, calendar);
    return row?.weekNumber ?? null;
  }, [runDate, calendar]);

  const weekRow = useMemo(
    () => (enrollmentWeek != null ? resolveEnrollmentWeekRow(enrollmentWeek, calendar) : null),
    [calendar, enrollmentWeek],
  );

  const weekRangeLabel = weekRow ? formatEnrollmentWeekRange(weekRow) : runDate;

  const groupNames = useMemo(() => {
    const set = new Set<string>();
    for (const c of children) {
      if (c.groupName) set.add(c.groupName);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [children]);

  const routeMeta: TransportRouteMeta[] = board?.routeMeta ?? [];
  const coreStops: Record<number, TransportRouteStop[]> = board?.coreStops ?? {};
  const schedules = board?.camperBusRunSchedules ?? {};
  const parentTransportCampers = board?.parentTransportCampers ?? [];

  const loadAll = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [cal, loadedBoard, enrollCtx, kids] = await Promise.all([
        loadEnrollmentWeekCalendar(supabase, companyId, currentSeason),
        loadTransportRunBoard(supabase, companyId, currentSeason, runDate),
        loadBusRunEnrollmentContext(supabase, companyId, currentSeason, runDate),
        loadTransportReportChildren(supabase, companyId, currentSeason, {
          enrollmentWeek: enrollmentWeek ?? undefined,
        }),
      ]);
      setCalendar(cal);
      setBoard(loadedBoard);
      setEnrollmentLookup(enrollCtx.enrollmentLookup);
      setChildren(kids);
      if (loadedBoard?.routeMeta.length) {
        setSelectedRouteIds(loadedBoard.routeMeta.map((r) => Number(r.id)));
      }
      setSelectedGroups(new Set(kids.map((k) => k.groupName)));
    } finally {
      setLoading(false);
    }
  }, [companyId, currentSeason, enrollmentWeek, runDate]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const selectedRoutes = routeMeta.filter((r) => selectedRouteIds.includes(Number(r.id)));

  const openPreview = (built: { blob: Blob; filename: string } | null, title: string, desc: string) => {
    if (!built) {
      toast({ title: "Nothing to export", variant: "destructive" });
      return;
    }
    setPreview({
      open: true,
      title,
      description: desc,
      kind: "pdf",
      blob: built.blob,
      filename: built.filename,
    });
  };

  const handleRouteSummaryPdf = () => {
    const rows = buildRouteSummaryRows(selectedRoutes, coreStops);
    const built = buildBusRouteSummaryPdf({
      companyName: currentCompany?.name ?? "Day Camp",
      season: currentSeason,
      dateLabel: weekRangeLabel,
      rows,
    });
    openPreview(built, "Bus Route Summary", `${selectedRoutes.length} route(s)`);
  };

  const handleGroupReport = async (groupName: string, downloadOnly = false) => {
    const groupKids = children.filter((c) => c.groupName === groupName);
    if (!groupKids.length) return;
    const campers = groupKids.map((c) =>
      childToGroupReportCamper(
        c,
        resolveCamperTransportLine(
          c.name,
          routeMeta,
          coreStops,
          parentTransportCampers,
          schedules,
        ),
      ),
    );
    const built = buildGroupReportPdf({
      companyName: currentCompany?.name ?? "Day Camp",
      season: currentSeason,
      weekDateRange: weekRangeLabel,
      groupName,
      totalCampers: groupKids.length,
      campers,
    });
    if (downloadOnly && built) triggerBlobDownload(built.blob, built.filename);
    else openPreview(built, "Group Report", groupName);
  };

  const handleSelectedGroupReports = () => {
    const names = groupNames.filter((g) => selectedGroups.has(g));
    names.forEach((name, i) => {
      window.setTimeout(() => void handleGroupReport(name, true), i * 500);
    });
    toast({ title: "Downloading group reports", description: `${names.length} PDF(s).` });
  };

  const handleBusRoster = async (routeId: number, downloadOnly = false) => {
    const route = routeMeta.find((r) => r.id === routeId);
    if (!route || enrollmentWeek == null) return;

    if (!board) return;

    const sheetRoutes = buildBusBubbleSheetRoutes({
      routes: [{ id: route.id, bus: route.bus, routeName: route.name }],
      baseCoreByRoute: (id) => consolidateRouteStopsByAddress(coreStops[id] ?? []),
      coreForRun: (id, period) => getEffectiveCoreStops(board, id, period),
      schedules,
      runDate,
      parentTransportCampers,
      enrollmentWeek,
      enrollmentLookup,
    });

    const bubbleRoute = sheetRoutes[0];
    if (!bubbleRoute?.campers.length) {
      toast({ title: "No campers on this bus for the selected week", variant: "destructive" });
      return;
    }

    const counselor = await loadBusCounselorForRoute(
      supabase,
      companyId!,
      currentSeason,
      route.bus,
    );

    const reportCampers: ReturnType<typeof childToGroupReportCamper>[] = [];
    for (const bc of bubbleRoute.campers) {
      const child = children.find((c) => c.name.trim().toLowerCase() === bc.name.trim().toLowerCase());
      if (child) {
        reportCampers.push(
          childToGroupReportCamper(
            child,
            resolveCamperTransportLine(
              child.name,
              routeMeta,
              coreStops,
              parentTransportCampers,
              schedules,
            ),
          ),
        );
      } else {
        reportCampers.push({
          name: bc.name,
          demographicsLine: "—",
          programLine: bc.detail ?? "—",
          transportLine: route.bus,
          contactsBlock: "—",
        });
      }
    }

    const built = buildBusRosterReportPdf({
      companyName: currentCompany?.name ?? "Day Camp",
      season: currentSeason,
      weekDateRange: weekRangeLabel,
      bus: route.bus,
      routeName: route.name,
      driverOrCounselor: counselor,
      totalPassengers: bubbleRoute.campers.length,
      campers: reportCampers,
      bubbleCampers: bubbleRoute.campers,
    });

    if (downloadOnly && built) triggerBlobDownload(built.blob, built.filename);
    else openPreview(built, "Bus Roster Report", route.bus);
  };

  const handleAllBusRosters = () => {
    selectedRouteIds.forEach((id, i) => {
      window.setTimeout(() => void handleBusRoster(id, true), i * 500);
    });
    toast({ title: "Downloading bus rosters", description: `${selectedRouteIds.length} PDF(s).` });
  };

  const toggleGroup = (name: string) => {
    setSelectedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleRoute = (id: number) => {
    setSelectedRouteIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  return (
    <div className="space-y-6">
      <FrontOfficeBackLink />
      <div>
        <h1 className="page-header flex items-center gap-2">
          <FileText className="h-6 w-6" /> Transport print reports
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          CampMinder-style PDFs — pick groups or buses, or use the{" "}
          <Link to="/day-camp/change-sheets" className="text-primary underline-offset-2 hover:underline">
            Master Change Sheet
          </Link>{" "}
          for daily changes.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Week &amp; date</CardTitle>
          <CardDescription>
            Enrollment week drives roster filters (set calendar under Group Bubble Sheets if needed).
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div>
            <Label htmlFor="tpr-date">Reference date</Label>
            <Input
              id="tpr-date"
              type="date"
              className="w-auto mt-1"
              value={runDate}
              onChange={(e) => setRunDate(e.target.value)}
            />
          </div>
          {enrollmentWeek != null ? (
            <p className="text-sm text-muted-foreground pb-1">
              {formatEnrollmentWeekLabel(enrollmentWeek, calendar)} · {weekRangeLabel}
            </p>
          ) : (
            <p className="text-sm text-amber-700 pb-1">No enrollment week for this date — showing full season roster.</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bus className="h-4 w-4" /> Bus route summary
          </CardTitle>
          <CardDescription>Stops, times, and passenger counts — PDF export.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelectedRouteIds(routeMeta.map((r) => r.id))}>
              Select all buses
            </Button>
            <Button size="sm" onClick={handleRouteSummaryPdf} disabled={!selectedRoutes.length || loading}>
              <Download className="mr-2 h-4 w-4" /> Download summary PDF
            </Button>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {routeMeta.map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={selectedRouteIds.includes(r.id)} onCheckedChange={() => toggleRoute(r.id)} />
                <span className="font-medium">{r.bus}</span>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bus className="h-4 w-4" /> Bus roster reports
          </CardTitle>
          <CardDescription>One PDF per bus — campers, contacts, AM/PM attendance bubbles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button size="sm" variant="secondary" onClick={handleAllBusRosters} disabled={!selectedRouteIds.length}>
            Download each selected bus PDF
          </Button>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {routeMeta.map((r) => (
              <Button
                key={r.id}
                type="button"
                size="sm"
                variant="outline"
                disabled={loading || enrollmentWeek == null}
                onClick={() => void handleBusRoster(r.id)}
              >
                {r.bus} PDF
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Users className="h-4 w-4" /> Group reports
          </CardTitle>
          <CardDescription>One PDF per camp group (Cheetahs, etc.) — parent contacts and weekday bubbles.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelectedGroups(new Set(groupNames))}>
              Select all groups
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handleSelectedGroupReports}
              disabled={!selectedGroups.size}
            >
              Download each selected group PDF
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-[320px] overflow-y-auto">
            {groupNames.map((name) => (
              <div key={name} className="flex items-center gap-2 rounded-md border px-2 py-1.5">
                <Checkbox checked={selectedGroups.has(name)} onCheckedChange={() => toggleGroup(name)} />
                <span className="flex-1 text-sm truncate">{name}</span>
                <Button type="button" size="sm" variant="ghost" className="h-7 px-2" onClick={() => void handleGroupReport(name)}>
                  PDF
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <TransportReportPreviewDialog
        preview={preview}
        onOpenChange={(open) => setPreview((p) => (p ? { ...p, open } : null))}
      />
    </div>
  );
}
