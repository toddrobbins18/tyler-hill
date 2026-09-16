import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useCompany } from "@/contexts/CompanyContext";
import { useSeasonContext } from "@/contexts/SeasonContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Clock, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  fetchTransportExceptionsForReport,
  todayDateString,
  type TransportRunPeriod,
} from "@/lib/transportDailyOverrides";
import { buildPendingChangeSheetRows, type TransportChangeSheetRow } from "@/lib/transportChangeSheets";
import { normalizeTransportBoardForSeason, type TransportRouteMeta, type TransportRouteStop } from "@/lib/transportRoster";
import { ROUTE_COLORS } from "@/lib/transportRunBoard";

type PendingAction =
  | { kind: "absence"; id: string; camper: string }
  | { kind: "pickup"; id: string; camper: string };

export default function PendingTransportChanges() {
  const { currentCompany } = useCompany();
  const { currentSeason } = useSeasonContext();
  const [sheetDate, setSheetDate] = useState(todayDateString());
  const [runPeriod, setRunPeriod] = useState<TransportRunPeriod>("am");
  const [routeMeta, setRouteMeta] = useState<TransportRouteMeta[]>([]);
  const [coreStops, setCoreStops] = useState<Record<number, TransportRouteStop[]>>({});
  const [rows, setRows] = useState<TransportChangeSheetRow[]>([]);
  const [actions, setActions] = useState<PendingAction[]>([]);
  const [loading, setLoading] = useState(true);

  const loadBoard = useCallback(async () => {
    if (!currentCompany?.id) return;
    const { data } = await supabase
      .from("transport_boards")
      .select("data")
      .eq("company_id", currentCompany.id)
      .eq("season", currentSeason)
      .maybeSingle();
    if (!data?.data || typeof data.data !== "object") return;
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

  const loadPending = useCallback(async () => {
    if (!currentCompany?.id) return;
    setLoading(true);
    try {
      const [exceptions, absenceRes, pickupRes] = await Promise.all([
        fetchTransportExceptionsForReport(supabase, currentCompany.id, sheetDate),
        supabase
          .from("absences")
          .select("id, children:camper_id(name)")
          .eq("company_id", currentCompany.id)
          .eq("absence_date", sheetDate)
          .eq("status", "submitted"),
        supabase
          .from("pickup_changes")
          .select("id, children:camper_id(name)")
          .eq("company_id", currentCompany.id)
          .eq("change_date", sheetDate)
          .eq("change_type", "bus_change")
          .eq("status", "submitted"),
      ]);

      const pendingActions: PendingAction[] = [];
      for (const row of absenceRes.data ?? []) {
        const name = (row as { children?: { name?: string } }).children?.name?.trim();
        if (name) pendingActions.push({ kind: "absence", id: row.id, camper: name });
      }
      for (const row of pickupRes.data ?? []) {
        const name = (row as { children?: { name?: string } }).children?.name?.trim();
        if (name) pendingActions.push({ kind: "pickup", id: row.id, camper: name });
      }
      setActions(pendingActions);

      const built = buildPendingChangeSheetRows({
        overrideDate: sheetDate,
        runPeriod,
        exceptions,
        routeMeta,
        coreStops,
        selectedRouteIds: [],
      });
      setRows(built.filter((r) => !r.camper.startsWith("(No transport")));
    } finally {
      setLoading(false);
    }
  }, [coreStops, currentCompany?.id, routeMeta, runPeriod, sheetDate]);

  useEffect(() => {
    void loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  const approve = async (action: PendingAction) => {
    const table = action.kind === "absence" ? "absences" : "pickup_changes";
    const { error } = await supabase.from(table).update({ status: "acknowledged" }).eq("id", action.id);
    if (error) toast.error(error.message);
    else {
      toast.success(`${action.camper} approved — will show on change sheets`);
      void loadPending();
    }
  };

  const findAction = (camper: string) =>
    actions.find((a) => a.camper.toLowerCase() === camper.toLowerCase());

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500">
            <Clock className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Pending Changes</h1>
            <p className="text-sm text-muted-foreground">
              Not on driver sheets until approved — pick any date including upcoming
            </p>
          </div>
        </div>
        <Button variant="outline" asChild>
          <Link to="/day-camp/change-sheets">Approved sheets →</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Date & run</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Input type="date" value={sheetDate} onChange={(e) => setSheetDate(e.target.value)} className="w-auto" />
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
        </CardContent>
      </Card>

      <p className="text-sm text-muted-foreground">{rows.length} pending item{rows.length === 1 ? "" : "s"}</p>

      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pending changes for this date.</p>
          ) : (
            <div className="space-y-3">
              {rows.map((row, i) => {
                const action = findAction(row.camper);
                return (
                  <div key={`${row.camper}-${i}`} className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold">{row.camper}</span>
                      <Badge variant="outline" className="border-amber-400 text-amber-800">
                        Pending
                      </Badge>
                    </div>
                    <p className="text-xs font-medium text-amber-800">{row.source}</p>
                    <p className="text-sm">{row.description}</p>
                    {row.notes ? <p className="text-xs italic">{row.notes}</p> : null}
                    {action ? (
                      <Button size="sm" className="mt-2" onClick={() => void approve(action)}>
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                    ) : (
                      <p className="mt-2 text-xs text-muted-foreground italic">
                        {row.source.includes("Swim")
                          ? "Waiting for parent swim lesson confirmation"
                          : "Review in office or parent portal"}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
