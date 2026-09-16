import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { FileText, Share2 } from "lucide-react";
import {
  fetchTransportExceptions,
  loadManualOverrides,
  todayDateString,
  type TransportRunPeriod,
} from "@/lib/transportDailyOverrides";
import {
  buildApprovedChangeSheetRows,
  changeSheetRowsToCsv,
  type TransportChangeSheetRow,
} from "@/lib/transportChangeSheets";
import { normalizeTransportBoardForSeason, type TransportRouteMeta, type TransportRouteStop } from "@/lib/transportRoster";
import { ROUTE_COLORS } from "@/lib/transportRunBoard";

export default function TransportChangeSheets() {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [sheetDate, setSheetDate] = useState(todayDateString());
  const [runPeriod, setRunPeriod] = useState<TransportRunPeriod>("am");
  const [selectedRouteIds, setSelectedRouteIds] = useState<number[]>([]);
  const [routeMeta, setRouteMeta] = useState<TransportRouteMeta[]>([]);
  const [coreStops, setCoreStops] = useState<Record<number, TransportRouteStop[]>>({});
  const [rows, setRows] = useState<TransportChangeSheetRow[]>([]);
  const [loading, setLoading] = useState(true);

  const allSelected = selectedRouteIds.length === 0 || selectedRouteIds.length === routeMeta.length;

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
  }, [currentCompany?.id, currentSeason]);

  const loadSheet = useCallback(async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    try {
      const [exceptions, manual] = await Promise.all([
        fetchTransportExceptions(supabase, currentCompany.id, sheetDate),
        loadManualOverrides(supabase, currentCompany.id, currentSeason, sheetDate),
      ]);
      const built = buildApprovedChangeSheetRows({
        overrideDate: sheetDate,
        runPeriod,
        exceptions,
        manual,
        routeMeta,
        coreStops,
        selectedRouteIds: allSelected ? [] : selectedRouteIds,
      });
      setRows(built.filter((r) => !r.camper.startsWith("(No transport")));
    } finally {
      setLoading(false);
    }
  }, [allSelected, coreStops, currentCompany?.id, currentSeason, routeMeta, runPeriod, selectedRouteIds, sheetDate]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    if (routeMeta.length || Object.keys(coreStops).length) void loadSheet();
    else if (!currentCompany?.id) setLoading(false);
  }, [coreStops, currentCompany?.id, loadSheet, routeMeta.length]);

  const routeLabel = useMemo(() => {
    if (allSelected) return "All routes";
    if (selectedRouteIds.length === 1) {
      const r = routeMeta.find((x) => x.id === selectedRouteIds[0]);
      return r ? `${r.bus} · ${r.name}` : "1 route";
    }
    return `${selectedRouteIds.length} routes`;
  }, [allSelected, routeMeta, selectedRouteIds]);

  const downloadCsv = () => {
    const csv = changeSheetRowsToCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transport-change-sheet-${sheetDate}-${runPeriod}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary">
            <FileText className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Change Sheets</h1>
            <p className="text-sm text-muted-foreground">
              Approved daily changes for drivers — season {currentSeason}
            </p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link to="/day-camp/pending-transport-changes">Pending changes →</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Pick a date, run, and one or more routes.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Input type="date" value={sheetDate} onChange={(e) => setSheetDate(e.target.value)} className="w-auto" />
          <div className="flex gap-1">
            {(["am", "pm"] as const).map((run) => (
              <Button
                key={run}
                size="sm"
                variant={runPeriod === run ? "default" : "outline"}
                onClick={() => setRunPeriod(run)}
              >
                {run.toUpperCase()}
              </Button>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={() => setSelectedRouteIds([])}>
            All routes
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelectedRouteIds([])}>
            Clear selection
          </Button>
          <Button size="sm" onClick={downloadCsv} disabled={!rows.length}>
            <Share2 className="mr-2 h-4 w-4" />
            Download CSV
          </Button>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {routeMeta.map((r) => {
          const active = allSelected || selectedRouteIds.includes(r.id);
          return (
            <Button
              key={r.id}
              size="sm"
              variant={active ? "default" : "outline"}
              style={active ? { borderLeftColor: r.color, borderLeftWidth: 4 } : undefined}
              onClick={() =>
                setSelectedRouteIds((prev) =>
                  prev.includes(r.id) ? prev.filter((id) => id !== r.id) : [...prev, r.id],
                )
              }
            >
              {r.bus}
            </Button>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground">
        {routeLabel} · {rows.length} approved change{rows.length === 1 ? "" : "s"}
      </p>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No approved changes for this date and filter. Pending items are on the Pending Changes page.
            </p>
          ) : (
            <div className="space-y-3">
              {rows.map((row, i) => (
                <div key={`${row.camper}-${i}`} className="rounded-lg border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold">{row.camper}</span>
                    <Badge variant="secondary" className="bg-green-100 text-green-800">
                      Approved
                    </Badge>
                  </div>
                  <p className="text-xs font-medium text-primary">{row.source}</p>
                  <p className="text-sm">{row.description}</p>
                  {row.bus ? (
                    <p className="text-xs text-muted-foreground">
                      {row.bus}
                      {row.route ? ` · ${row.route}` : ""}
                      {row.stop ? ` · ${row.stop}` : ""}
                    </p>
                  ) : null}
                  {row.notes ? <p className="text-xs italic">{row.notes}</p> : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
