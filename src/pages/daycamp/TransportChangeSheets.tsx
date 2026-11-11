import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { FrontOfficeBackLink } from "@/components/daycamp/FrontOfficeBackLink";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileDown, FileText, Printer, Share2 } from "lucide-react";
import { TransportReportPreviewDialog, type TransportReportPreview } from "@/components/TransportReportPreviewDialog";
import {
  buildCamperSheetMetaLookup,
  buildMasterChangeSheetPdf,
  mapRowsToMasterChangeSheetPdf,
} from "@/lib/transportChangeSheetPdf";
import {
  fetchTransportExceptions,
  loadManualOverrides,
  todayDateString,
} from "@/lib/transportDailyOverrides";
import { loadBusAttendance } from "@/lib/transportBusAttendance";
import {
  buildApprovedChangeSheetRows,
  changeSheetRowsToCsv,
  mergeDailyChangeSheets,
  PARENT_TRANSPORT_CHANGE_SHEET_BUS,
  sortChangeSheetRowsByBus,
  type TransportChangeSheetRow,
} from "@/lib/transportChangeSheets";
import { reviewPaperAttendance, type ChangeSheetAttendanceSource } from "@/lib/paperAttendance";
import {
  loadChangeSheetAttendanceSource,
  loadPaperAttendance,
  saveChangeSheetAttendanceSource,
} from "@/lib/paperAttendanceStore";
import { normalizeTransportBoardForSeason, type TransportRouteMeta, type TransportRouteStop } from "@/lib/transportRoster";
import { ROUTE_COLORS } from "@/lib/transportRunBoard";
import { resolveTransportPdfBranding } from "@/lib/transportReportPdfBranding";

type RouteWithColor = TransportRouteMeta & { color: string };

export default function TransportChangeSheets() {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [sheetDate, setSheetDate] = useState(todayDateString());
  const [selectedRouteIds, setSelectedRouteIds] = useState<number[]>([]);
  const [includeParentTransport, setIncludeParentTransport] = useState(true);
  const [routeMeta, setRouteMeta] = useState<RouteWithColor[]>([]);
  const [coreStops, setCoreStops] = useState<Record<number, TransportRouteStop[]>>({});
  const [parentTransportCampers, setParentTransportCampers] = useState<
    { routeId: number | null; name: string }[]
  >([]);
  const [rows, setRows] = useState<TransportChangeSheetRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [camperMetaLookup, setCamperMetaLookup] = useState(() => new Map());
  const [totalCampers, setTotalCampers] = useState<number | undefined>(undefined);
  const [reportPreview, setReportPreview] = useState<TransportReportPreview | null>(null);
  const [attendanceSource, setAttendanceSource] = useState<ChangeSheetAttendanceSource>("paperless");

  const routeIdsKey = useMemo(() => routeMeta.map((r) => r.id).join(","), [routeMeta]);

  useEffect(() => {
    setSelectedRouteIds(routeMeta.map((r) => r.id));
    setIncludeParentTransport(true);
  }, [routeIdsKey, routeMeta]);

  const loadBoard = useCallback(async () => {
    if (!currentCompany?.id) return;
    const { data } = await supabase
      .from("transport_boards")
      .select("data")
      .eq("company_id", currentCompany.id)
      .eq("season", currentSeason)
      .maybeSingle();
    if (!data?.data || typeof data.data !== "object") {
      setRouteMeta([]);
      setCoreStops({});
      setParentTransportCampers([]);
      return;
    }
    const normalized = await normalizeTransportBoardForSeason(
      supabase,
      currentCompany.id,
      currentSeason,
      data.data as never,
    );
    setRouteMeta(
      (normalized.routeMeta ?? []).map((r, i) => ({
        ...r,
        id: Number(r.id),
        color: r.color || ROUTE_COLORS[i % ROUTE_COLORS.length],
      })),
    );
    const stops: Record<number, TransportRouteStop[]> = {};
    for (const [k, v] of Object.entries(normalized.coreStops ?? {})) {
      stops[Number(k)] = v as TransportRouteStop[];
    }
    setCoreStops(stops);
    setParentTransportCampers(
      (normalized.parentTransportCampers ?? []).map((c) => ({
        routeId: c.routeId ?? null,
        name: c.name,
      })),
    );
  }, [currentCompany?.id, currentSeason]);

  const loadSheet = useCallback(async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    try {
      if (!selectedRouteIds.length && !includeParentTransport) {
        setRows([]);
        return;
      }
      const [exceptions, manual, amAttendance, pmAttendance, paper, source] = await Promise.all([
        fetchTransportExceptions(supabase, currentCompany.id, sheetDate),
        loadManualOverrides(supabase, currentCompany.id, currentSeason, sheetDate),
        loadBusAttendance(supabase, currentCompany.id, currentSeason, sheetDate, "am"),
        loadBusAttendance(supabase, currentCompany.id, currentSeason, sheetDate, "pm"),
        loadPaperAttendance(supabase, currentCompany.id, currentSeason, sheetDate),
        loadChangeSheetAttendanceSource(supabase, currentCompany.id, currentSeason),
      ]);
      setAttendanceSource(source);
      const confirmed = reviewPaperAttendance(paper.bus, paper.group).confirmed;
      const shared = {
        overrideDate: sheetDate,
        exceptions,
        manual,
        routeMeta,
        coreStops,
        selectedRouteIds,
        includeParentTransport,
        parentTransportCampers,
        attendanceSource: source,
        paperConfirmedAbsents: confirmed,
      };
      const built = mergeDailyChangeSheets(
        buildApprovedChangeSheetRows({
          ...shared,
          runPeriod: "am",
          busAttendance: source === "paper_scan" ? undefined : amAttendance.records,
        }),
        buildApprovedChangeSheetRows({
          ...shared,
          runPeriod: "pm",
          busAttendance: source === "paper_scan" ? undefined : pmAttendance.records,
        }),
      );
      const filtered = built.filter((r) => !r.camper.startsWith("(No transport"));
      setRows(sortChangeSheetRowsByBus(filtered, routeMeta));
    } finally {
      setLoading(false);
    }
  }, [
    coreStops,
    currentCompany?.id,
    currentSeason,
    parentTransportCampers,
    routeMeta,
    includeParentTransport,
    selectedRouteIds,
    sheetDate,
  ]);

  const loadCamperMeta = useCallback(async () => {
    if (!currentCompany?.id) {
      setCamperMetaLookup(new Map());
      setTotalCampers(undefined);
      return;
    }
    const { data } = await supabase
      .from("children")
      .select("name, group_name, grade, division:division_id(name)")
      .eq("company_id", currentCompany.id)
      .eq("season", currentSeason)
      .neq("status", "inactive");
    const list = data ?? [];
    setCamperMetaLookup(buildCamperSheetMetaLookup(list));
    setTotalCampers(list.length);
  }, [currentCompany?.id, currentSeason]);

  useEffect(() => {
    void loadBoard();
    void loadCamperMeta();
  }, [loadBoard, loadCamperMeta]);

  useEffect(() => {
    if (routeMeta.length || Object.keys(coreStops).length) void loadSheet();
    else if (!currentCompany?.id) setLoading(false);
  }, [coreStops, currentCompany?.id, loadSheet, routeMeta.length]);

  const allBusesSelected =
    routeMeta.length > 0 && selectedRouteIds.length === routeMeta.length;
  const masterSheetSelected = allBusesSelected && includeParentTransport;

  const routeLabel = useMemo(() => {
    if (!selectedRouteIds.length && !includeParentTransport) return "Nothing selected";
    if (!selectedRouteIds.length && includeParentTransport) return PARENT_TRANSPORT_CHANGE_SHEET_BUS;
    if (masterSheetSelected) return "Master sheet — all buses & PT";
    if (allBusesSelected && !includeParentTransport) return "All buses (PT excluded)";
    if (!allBusesSelected && includeParentTransport && selectedRouteIds.length === 0)
      return PARENT_TRANSPORT_CHANGE_SHEET_BUS;
    if (selectedRouteIds.length === 1) {
      const r = routeMeta.find((x) => x.id === selectedRouteIds[0]);
      return r ? `${r.bus} · ${r.name}` : "1 bus";
    }
    const parts = [`${selectedRouteIds.length} bus${selectedRouteIds.length === 1 ? "" : "es"}`];
    if (includeParentTransport) parts.push("PT");
    return parts.join(" + ");
  }, [allBusesSelected, includeParentTransport, masterSheetSelected, routeMeta, selectedRouteIds]);

  const sheetRows = useMemo(() => {
    const mapped = mapRowsToMasterChangeSheetPdf(rows, camperMetaLookup);
    return [...mapped].sort(
      (a, b) => a.transportation.localeCompare(b.transportation) || a.camper.localeCompare(b.camper),
    );
  }, [camperMetaLookup, rows]);

  const toggleRoute = (routeId: number) => {
    setSelectedRouteIds((prev) =>
      prev.includes(routeId) ? prev.filter((id) => id !== routeId) : [...prev, routeId],
    );
  };

  const selectAllBuses = () => {
    setSelectedRouteIds(routeMeta.map((r) => r.id));
    setIncludeParentTransport(true);
  };

  const downloadPdf = async () => {
    if (!rows.length || !currentCompany?.name) return;
    const branding = await resolveTransportPdfBranding(currentCompany);
    const pdfRows = mapRowsToMasterChangeSheetPdf(rows, camperMetaLookup);
    const built = buildMasterChangeSheetPdf({
      companyName: branding.companyName,
      season: currentSeason,
      sheetDate,
      runPeriod: "daily",
      totalCampers,
      rows: pdfRows,
      logo: branding.logo,
      printedAt: branding.printedAt,
    });
    if (!built) return;
    setReportPreview({
      open: true,
      title: "Master Change Sheet",
      description: `${sheetDate} · ${routeLabel} · buses and PT`,
      kind: "pdf",
      blob: built.blob,
      filename: built.filename,
    });
  };

  const downloadCsv = () => {
    if (!rows.length) return;
    const csv = changeSheetRowsToCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const busSuffix = masterSheetSelected
      ? "master-all-buses-pt"
      : allBusesSelected && !includeParentTransport
        ? "master-all-buses"
      : routeMeta
          .filter((r) => selectedRouteIds.includes(r.id))
          .map((r) => r.bus.replace(/\s+/g, "-"))
          .join("-");
    a.download = `master-change-sheet-${sheetDate}-${busSuffix}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="no-print">
        <FrontOfficeBackLink />
      </div>

      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary print:hidden">
            <FileText className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Master Change Sheet</h1>
            <p className="text-sm text-muted-foreground print:text-foreground">
              Daily transport changes for drivers — select all buses or pick specific buses · season{" "}
              {currentSeason}.{" "}
              <Link to="/day-camp/transport-reports" className="text-primary underline-offset-2 hover:underline">
                Group &amp; bus print reports
              </Link>
              {" · "}
              <Link to="/day-camp/conflict-review" className="text-primary underline-offset-2 hover:underline">
                Conflict Review
              </Link>
            </p>
          </div>
        </div>
        <Button variant="outline" asChild className="no-print">
          <Link to="/day-camp/pending-transport-changes">Pending changes →</Link>
        </Button>
      </div>

      <Card className="no-print">
        <CardHeader>
          <CardTitle className="text-base">Date</CardTitle>
          <CardDescription>
            One daily sheet for every bus and parent transport (PT). AM and PM changes are combined.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Input type="date" value={sheetDate} onChange={(e) => setSheetDate(e.target.value)} className="w-auto" />
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground">Absents from</span>
            <Button
              size="sm"
              variant={attendanceSource === "paperless" ? "default" : "outline"}
              onClick={() => {
                setAttendanceSource("paperless");
                if (currentCompany?.id) {
                  void saveChangeSheetAttendanceSource(
                    supabase,
                    currentCompany.id,
                    currentSeason,
                    "paperless",
                  ).then(() => void loadSheet());
                }
              }}
            >
              Paperless
            </Button>
            <Button
              size="sm"
              variant={attendanceSource === "paper_scan" ? "default" : "outline"}
              onClick={() => {
                setAttendanceSource("paper_scan");
                if (currentCompany?.id) {
                  void saveChangeSheetAttendanceSource(
                    supabase,
                    currentCompany.id,
                    currentSeason,
                    "paper_scan",
                  ).then(() => void loadSheet());
                }
              }}
            >
              Paper scan
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="no-print">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base">Select buses</CardTitle>
              <CardDescription>
                Check buses and Parent Transport (PT), or use Select all for the full master sheet.
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={masterSheetSelected ? "default" : "outline"} onClick={selectAllBuses}>
                Select all (buses + PT)
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setSelectedRouteIds([])}>
                Clear selection
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {routeMeta.map((r) => {
              const checked = selectedRouteIds.includes(r.id);
              return (
                <label
                  key={r.id}
                  className="flex items-center gap-2 cursor-pointer text-sm rounded-md border px-3 py-2 hover:bg-muted/40"
                  style={{ borderLeftColor: r.color, borderLeftWidth: 3 }}
                >
                  <Checkbox checked={checked} onCheckedChange={() => toggleRoute(r.id)} />
                  <span className="font-medium">{r.bus}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-[160px]">{r.name}</span>
                </label>
              );
            })}
            <label
              className="flex items-center gap-2 cursor-pointer text-sm rounded-md border px-3 py-2 hover:bg-muted/40 border-dashed"
            >
              <Checkbox
                checked={includeParentTransport}
                onCheckedChange={(v) => setIncludeParentTransport(v === true)}
              />
              <span className="font-medium">{PARENT_TRANSPORT_CHANGE_SHEET_BUS}</span>
              <span className="text-xs text-muted-foreground">Car / parent drop-off &amp; pick-up</span>
            </label>
          </div>
          {!routeMeta.length ? (
            <p className="text-sm text-muted-foreground">No buses configured for this season.</p>
          ) : null}
          <div className="flex flex-wrap items-center gap-2 border-t pt-4">
            <Button
              size="sm"
              onClick={downloadPdf}
              disabled={!rows.length || (!selectedRouteIds.length && !includeParentTransport)}
            >
              <FileDown className="mr-2 h-4 w-4" />
              Download PDF
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={downloadCsv}
              disabled={!rows.length || (!selectedRouteIds.length && !includeParentTransport)}
            >
              <Share2 className="mr-2 h-4 w-4" />
              Download CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handlePrint}
              disabled={!rows.length || (!selectedRouteIds.length && !includeParentTransport)}
            >
              <Printer className="mr-2 h-4 w-4" />
              Print
            </Button>
            {masterSheetSelected ? (
              <Badge variant="secondary" className="bg-primary/10 text-primary">
                Master — all buses &amp; PT
              </Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <div className="hidden print:block text-sm text-muted-foreground">
        {sheetDate} · {routeLabel} · {rows.length} change{rows.length === 1 ? "" : "s"}
      </div>

      <p className="text-sm text-muted-foreground no-print">
        {routeLabel} · {rows.length} approved change{rows.length === 1 ? "" : "s"}
      </p>

      <Card className="print:border-0 print:shadow-none">
        <CardContent className="pt-6 print:pt-0">
          {loading ? (
            <div className="flex justify-center py-8 no-print">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : !selectedRouteIds.length && !includeParentTransport ? (
            <p className="text-sm text-muted-foreground no-print">
              Select at least one bus or Parent Transport (PT) to view the change sheet.
            </p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No approved changes for this date and filter. Pending items are on the Pending Changes page.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2 pr-3 font-semibold">Camper</th>
                    <th className="py-2 pr-3 font-semibold">Transportation</th>
                    <th className="py-2 pr-3 font-semibold">Division</th>
                    <th className="py-2 pr-3 font-semibold">Group</th>
                    <th className="py-2 font-semibold">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {sheetRows.map((row, i) => (
                    <tr key={`${row.camper}-${row.change}-${i}`} className="border-b">
                      <td className="py-2 pr-3 font-semibold">{row.camper}</td>
                      <td className="py-2 pr-3">{row.transportation}</td>
                      <td className="py-2 pr-3">{row.division}</td>
                      <td className="py-2 pr-3">{row.group}</td>
                      <td className="py-2">{row.change}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <TransportReportPreviewDialog
        preview={reportPreview}
        onOpenChange={(open) => setReportPreview((prev) => (prev ? { ...prev, open } : null))}
      />
    </div>
  );
}
