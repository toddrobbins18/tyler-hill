import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyRouteOverrides,
  emptyManualOverrides,
  excludedCamperSet,
  fetchTransportExceptions,
  loadManualOverrides,
  type TransportException,
  type TransportManualOverrides,
  type TransportRouteStop,
} from "@/lib/transportDailyOverrides";
import { compareBusLabels } from "@/lib/transportBusAttendance";
import { normalizeTransportBoardForSeason } from "@/lib/transportRoster";

export type TransportRouteMeta = {
  id: number;
  name: string;
  bus: string;
  departure: string;
  status: string;
  capacity: number;
  color: string;
};

export type TransportRunRoute = TransportRouteMeta & {
  campers: number;
  direction: string;
};

const ROUTE_COLORS = [
  "#3eb8a0", "#4a9eff", "#f59e0b", "#ef4444", "#a855f7",
  "#ec4899", "#22c55e", "#eab308", "#06b6d4", "#f97316",
];

export type TransportRunBoard = {
  routeMeta: TransportRouteMeta[];
  coreStops: Record<number, TransportRouteStop[]>;
  todayOverrides: TransportManualOverrides;
  transportExceptions: TransportException[];
};

export async function loadTransportRunBoard(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  overrideDate: string,
): Promise<TransportRunBoard> {
  const [{ data: boardRow }, manual, exceptions] = await Promise.all([
    supabase
      .from("transport_boards")
      .select("data")
      .eq("company_id", companyId)
      .eq("season", season)
      .maybeSingle(),
    loadManualOverrides(supabase, companyId, season, overrideDate),
    fetchTransportExceptions(supabase, companyId, overrideDate),
  ]);

  let routeMeta: TransportRouteMeta[] = [];
  let coreStops: Record<number, TransportRouteStop[]> = {};

  if (boardRow?.data && typeof boardRow.data === "object") {
    const saved = boardRow.data as {
      routeMeta?: TransportRouteMeta[];
      coreStops?: Record<number, TransportRouteStop[]>;
      unplottedCampers?: unknown[];
      routesConfigured?: boolean;
      routesSeason?: string;
      routesSource?: "mappoint2026" | "manual";
    };
    const normalized = await normalizeTransportBoardForSeason(supabase, companyId, season, {
      routeMeta: Array.isArray(saved.routeMeta)
        ? saved.routeMeta.map((r, i) => ({
          ...r,
          id: Number(r.id),
          color: r.color || ROUTE_COLORS[i % ROUTE_COLORS.length],
        }))
        : [],
      coreStops: saved.coreStops && typeof saved.coreStops === "object"
        ? Object.fromEntries(
          Object.entries(saved.coreStops).map(([k, v]) => [Number(k), v as TransportRouteStop[]]),
        )
        : {},
      unplottedCampers: Array.isArray(saved.unplottedCampers) ? saved.unplottedCampers as never : [],
      routesConfigured: saved.routesConfigured,
      routesSeason: saved.routesSeason,
      routesSource: saved.routesSource,
    });
    routeMeta = normalized.routeMeta;
    coreStops = normalized.coreStops;
  }

  return {
    routeMeta,
    coreStops,
    todayOverrides: manual ?? emptyManualOverrides(),
    transportExceptions: exceptions,
  };
}

export function getEffectiveCoreStops(
  board: Pick<TransportRunBoard, "coreStops" | "todayOverrides" | "transportExceptions">,
  routeId: number,
  runPeriod: "am" | "pm",
): TransportRouteStop[] {
  const excluded = excludedCamperSet(board.transportExceptions, runPeriod);
  return applyRouteOverrides(
    board.coreStops[routeId] ?? [],
    routeId,
    board.todayOverrides,
    excluded,
  );
}

export function buildRunRoutes(
  board: TransportRunBoard,
  runPeriod: "am" | "pm",
): TransportRunRoute[] {
  return board.routeMeta
    .map((meta) => {
      const core = getEffectiveCoreStops(board, meta.id, runPeriod);
      const campers = core.reduce((sum, s) => sum + s.passengers, 0);
      return {
        ...meta,
        campers,
        direction: runPeriod === "am" ? "Inbound" : "Outbound",
      };
    })
    .filter((r) => r.campers > 0)
    .sort((a, b) => compareBusLabels(a.bus, b.bus));
}
