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
import { buildBusBubbleSheetRoutes, buildPtOnlyBubbleSheetCampers } from "@/lib/transportCamperBusRun";
import { PARENT_TRANSPORT_CHANGE_SHEET_BUS } from "@/lib/transportParentTransport";
import {
  buildBusRouteSummaryPdf,
  buildBusRosterReportPdf,
  buildGroupReportPdf,
} from "@/lib/transportCampMinderReportsPdf";
import {
  buildRouteSummaryRows,
  childToGroupReportCamper,
  loadBusCounselorForRoute,
  loadGroupStaffNames,
  loadTransportReportChildren,
  reportCampersForBusRoster,
  resolveCamperTransportLine,
  sessionSummaryForCampers,
} from "@/lib/transportReportData";
import {
  enrollmentWeekForDate,
  formatEnrollmentWeekLabel,
  formatEnrollmentWeekRange,
  getEnrollmentWeekRow,
  loadEnrollmentWeekCalendar,
} from "@/lib/enrollmentWeekCalendar";
import { todayDateString } from "@/lib/transportDailyOverrides";
import { useToast } from "@/hooks/use-toast";
import { resolveTransportPdfBranding } from "@/lib/transportReportPdfBranding";

const PT_ROSTER_ROUTE_ID = -1;

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
  const [exporting, setExporting] = useState(false);

  const enrollmentWeek = useMemo(
    () => enrollmentWeekForDate(calendar, runDate),
    [runDate, calendar],
  );

  const weekRow = useMemo(
    () => (enrollmentWeek != null ? getEnrollmentWeekRow(calendar, enrollmentWeek) : null),
    [calendar, enrollmentWeek],
  );

  const weekRangeLabel = weekRow ? formatEnrollmentWeekRange(weekRow, runDate) : runDate;

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
  const ptOnlyCampers = useMemo(
    () =>
      buildPtOnlyBubbleSheetCampers({
        parentTransportCampers,
        runDate,
        enrollmentWeek,
        enrollmentLookup,
      }),
    [parentTransportCampers, runDate, enrollmentWeek, enrollmentLookup],
  );

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
      setEnrollmentLookup(enrollCtx?.enrollmentLookup);
      setChildren(kids);
      const ids = (loadedBoard?.routeMeta ?? []).map((r) => Number(r.id));
      const ptKids = buildPtOnlyBubbleSheetCampers({
        parentTransportCampers: loadedBoard?.parentTransportCampers ?? [],
        runDate,
        enrollmentWeek: enrollmentWeek ?? undefined,
        enrollmentLookup: enrollCtx?.enrollmentLookup,
      });
      if (ptKids.length) ids.push(PT_ROSTER_ROUTE_ID);
      setSelectedRouteIds((prev) => {
        const kept = ids.filter((id) => prev.includes(id));
        return kept.length ? kept : ids;
      });
      setSelectedGroups((prev) => {
        const names = new Set(kids.map((k) => k.groupName));
        const kept = [...prev].filter((name) => names.has(name));
        return kept.length ? new Set(kept) : names;
      });
    } finally {
      setLoading(false);
    }
  }, [companyId, currentSeason, enrollmentWeek, runDate]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const allRosterRouteIds = useMemo(() => {
    const ids = routeMeta.map((r) => Number(r.id));
    if (ptOnlyCampers.length) ids.push(PT_ROSTER_ROUTE_ID);
    return ids;
  }, [routeMeta, ptOnlyCampers.length]);

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

  const handleRouteSummaryPdf = async (routeIds?: number[]) => {
    const branding = await resolveTransportPdfBranding(currentCompany);
    const routes = routeMeta.filter((route) => (routeIds ?? selectedRouteIds).includes(Number(route.id)));
    const files = routes.flatMap((route) => {
      const built = buildBusRouteSummaryPdf({
        companyName: branding.companyName,
        season: currentSeason,
        dateLabel: weekRangeLabel,
        rows: buildRouteSummaryRows([route], coreStops),
        logo: branding.logo,
        printedAt: branding.printedAt,
      });
      return built ? [{ built, bus: route.bus }] : [];
    });
    if (!files.length) {
      toast({ title: "Nothing to export", variant: "destructive" });
      return;
    }
    if (files.length === 1) {
      triggerBlobDownload(files[0].built.blob, files[0].built.filename);
      openPreview(files[0].built, "Bus Route Summary", files[0].bus);
      return;
    }
    for (const file of files) {
      triggerBlobDownload(file.built.blob, file.built.filename);
    }
    toast({ title: `Downloaded ${files.length} route summaries`, description: `${files.length} PDF(s), one per bus.` });
  };

  const handleGroupReport = async (groupName: string, downloadOnly = false): Promise<boolean> => {
    const groupKids = children.filter((c) => c.groupName === groupName);
    if (!groupKids.length) return false;
    const campers = groupKids.map((c) => ({
      ...childToGroupReportCamper(
        c,
        resolveCamperTransportLine(
          c.name,
          routeMeta,
          coreStops,
          parentTransportCampers,
          schedules,
        ),
      ),
      transportLine: "",
    }));
    const branding = await resolveTransportPdfBranding(currentCompany);
    const staffNames = companyId
      ? await loadGroupStaffNames(supabase, companyId, currentSeason, groupName)
      : [];
    const built = buildGroupReportPdf({
      companyName: branding.companyName,
      season: currentSeason,
      weekDateRange: weekRangeLabel,
      groupName,
      totalCampers: groupKids.length,
      staffNames,
      sessionSummary: sessionSummaryForCampers(groupKids),
      campers,
      logo: branding.logo,
      printedAt: branding.printedAt,
    });
    if (!built) return false;
    if (downloadOnly) triggerBlobDownload(built.blob, built.filename);
    else openPreview(built, "Group Report", groupName);
    return true;
  };

  const handleSelectedGroupReports = async () => {
    const names = groupNames.filter((g) => selectedGroups.has(g));
    if (!names.length) {
      toast({ title: "Select at least one group", variant: "destructive" });
      return;
    }
    if (names.length === 1) {
      await handleGroupReport(names[0]);
      return;
    }
    let downloaded = 0;
    for (const name of names) {
      if (await handleGroupReport(name, true)) downloaded += 1;
    }
    toast({
      title: downloaded ? `Downloaded ${downloaded} group PDF${downloaded === 1 ? "" : "s"}` : "Nothing to export",
      variant: downloaded ? "default" : "destructive",
    });
  };

  const buildBusRosterFile = async (routeId: number): Promise<{ blob: Blob; filename: string; label: string } | null> => {
    if (!board) return null;
    const branding = await resolveTransportPdfBranding(currentCompany);

    if (routeId === PT_ROSTER_ROUTE_ID) {
      if (!ptOnlyCampers.length) return null;
      const reportCampers = reportCampersForBusRoster(
        ptOnlyCampers,
        children,
        routeMeta,
        coreStops,
        parentTransportCampers,
        schedules,
        PARENT_TRANSPORT_CHANGE_SHEET_BUS,
      );
      const built = buildBusRosterReportPdf({
        companyName: branding.companyName,
        season: currentSeason,
        weekDateRange: weekRangeLabel,
        bus: PARENT_TRANSPORT_CHANGE_SHEET_BUS,
        routeName: "Parent drop-off / pick-up",
        totalPassengers: ptOnlyCampers.length,
        campers: reportCampers,
        bubbleCampers: ptOnlyCampers,
        logo: branding.logo,
        printedAt: branding.printedAt,
      });
      return built ? { ...built, label: PARENT_TRANSPORT_CHANGE_SHEET_BUS } : null;
    }

    const route = routeMeta.find((r) => Number(r.id) === Number(routeId));
    if (!route) return null;

    const sheetRoutes = buildBusBubbleSheetRoutes({
      routes: [{ id: Number(route.id), bus: route.bus, routeName: route.name }],
      baseCoreByRoute: (id) => consolidateRouteStopsByAddress(coreStops[id] ?? []),
      coreForRun: (id, period) => getEffectiveCoreStops(board, id, period),
      schedules,
      runDate,
      parentTransportCampers,
      enrollmentWeek,
      enrollmentLookup,
    });

    const bubbleRoute = sheetRoutes[0];
    if (!bubbleRoute?.campers.length) return null;

    const counselor = companyId
      ? await loadBusCounselorForRoute(supabase, companyId, currentSeason, route.bus)
      : null;

    const reportCampers = reportCampersForBusRoster(
      bubbleRoute.campers,
      children,
      routeMeta,
      coreStops,
      parentTransportCampers,
      schedules,
      route.bus,
    );

    const built = buildBusRosterReportPdf({
      companyName: branding.companyName,
      season: currentSeason,
      weekDateRange: weekRangeLabel,
      bus: route.bus,
      routeName: route.name,
      driverOrCounselor: counselor,
      totalPassengers: bubbleRoute.campers.length,
      campers: reportCampers,
      bubbleCampers: bubbleRoute.campers,
      logo: branding.logo,
      printedAt: branding.printedAt,
    });
    return built ? { ...built, label: route.bus } : null;
  };

  const handleBusRoster = async (routeId: number, downloadOnly = false): Promise<boolean> => {
    if (!board) {
      if (!downloadOnly) toast({ title: "Routes are still loading", variant: "destructive" });
      return false;
    }
    const built = await buildBusRosterFile(routeId);
    if (!built) {
      if (!downloadOnly) {
        toast({
          title: routeId === PT_ROSTER_ROUTE_ID
            ? "No parent transport campers for this week"
            : "No campers on this bus for the selected week",
          variant: "destructive",
        });
      }
      return false;
    }
    if (downloadOnly) triggerBlobDownload(built.blob, built.filename);
    else openPreview(built, "Bus Roster Report", built.label);
    return true;
  };

  const handleAllBusRosters = async () => {
    const ids = selectedRouteIds.filter(
      (id) => id === PT_ROSTER_ROUTE_ID || routeMeta.some((r) => Number(r.id) === Number(id)),
    );
    if (!ids.length) {
      toast({ title: "Select at least one bus", variant: "destructive" });
      return;
    }
    setExporting(true);
    try {
      const files: { blob: Blob; filename: string; label: string }[] = [];
      for (const id of ids) {
        const built = await buildBusRosterFile(id);
        if (built) files.push(built);
      }
      if (!files.length) {
        toast({ title: "No campers on the selected buses for this week", variant: "destructive" });
        return;
      }
      for (const file of files) {
        triggerBlobDownload(file.blob, file.filename);
      }
      if (files.length === 1) {
        openPreview(files[0], "Bus Roster Report", files[0].label);
      }
      toast({
        title: `Downloaded ${files.length} bus roster PDF${files.length === 1 ? "" : "s"}`,
        description: files.map((file) => file.label).join(", "),
      });
    } finally {
      setExporting(false);
    }
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
    const routeId = Number(id);
    setSelectedRouteIds((prev) =>
      prev.includes(routeId) ? prev.filter((x) => x !== routeId) : [...prev, routeId],
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

      <Card id="route-summary">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bus className="h-4 w-4" /> Bus route summary
          </CardTitle>
          <CardDescription>One PDF per bus. Select the buses you want, or download one bus at a time.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelectedRouteIds(allRosterRouteIds)}>
              Select all buses
            </Button>
            <Button size="sm" onClick={() => void handleRouteSummaryPdf()} disabled={!selectedRoutes.length || loading}>
              <Download className="mr-2 h-4 w-4" /> Download each selected bus PDF
            </Button>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {routeMeta.map((r) => (
              <label key={r.id} className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={selectedRouteIds.includes(Number(r.id))}
                  onCheckedChange={() => toggleRoute(Number(r.id))}
                />
                <span className="font-medium">{r.bus}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void handleRouteSummaryPdf([r.id]);
                  }}
                >
                  PDF
                </Button>
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card id="bus-rosters">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bus className="h-4 w-4" /> Bus roster reports
          </CardTitle>
          <CardDescription>
            One PDF per bus — campers, contacts, AM/PM attendance bubbles. Parent transport (PT) kids on a bus are on that roster; PT-only is a separate checkbox.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setSelectedRouteIds(allRosterRouteIds)}>
              Select all buses
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setSelectedRouteIds([])}
            >
              Clear
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={() => void handleAllBusRosters()}
              disabled={!selectedRouteIds.length || loading || exporting}
            >
              <Download className="mr-2 h-4 w-4" /> {exporting ? "Preparing PDFs…" : "Download each selected bus PDF"}
            </Button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 max-h-[320px] overflow-y-auto">
            {routeMeta.map((r) => (
              <label key={r.id} className="flex items-center gap-2 rounded-md border px-2 py-1.5 cursor-pointer">
                <Checkbox
                  checked={selectedRouteIds.includes(Number(r.id))}
                  onCheckedChange={() => toggleRoute(Number(r.id))}
                />
                <span className="flex-1 text-sm truncate font-medium">{r.bus}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  disabled={loading}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void handleBusRoster(Number(r.id));
                  }}
                >
                  PDF
                </Button>
              </label>
            ))}
            {ptOnlyCampers.length > 0 ? (
              <label className="flex items-center gap-2 rounded-md border px-2 py-1.5 cursor-pointer">
                <Checkbox
                  checked={selectedRouteIds.includes(PT_ROSTER_ROUTE_ID)}
                  onCheckedChange={() => toggleRoute(PT_ROSTER_ROUTE_ID)}
                />
                <span className="flex-1 text-sm truncate font-medium">{PARENT_TRANSPORT_CHANGE_SHEET_BUS}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  disabled={loading}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    void handleBusRoster(PT_ROSTER_ROUTE_ID);
                  }}
                >
                  PDF
                </Button>
              </label>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <Card id="group-reports">
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
