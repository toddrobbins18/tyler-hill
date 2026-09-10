import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getBundledMappointRoutesCsv2026,
  parseMappointRoutesCsv,
  resolveBundledGeocodeResult,
  type ParsedMappointRoute,
} from "@/lib/mappointTransportImport";

export type TransportEnrolledCamper = {
  id: string;
  name: string;
  age: number | null;
  session: string | null;
  grade: string | null;
  groupName: string | null;
};

export type TransportUnplottedCamper = {
  id: number;
  name: string;
  address: string;
  lat: number;
  lng: number;
  age: number;
  session: string;
};

export type TransportRouteStop = {
  name: string;
  address: string;
  lat: number;
  lng: number;
  pickupTime: string;
  passengers: number;
  camperNames?: string[];
};

export type TransportRouteMeta = {
  id: number;
  name: string;
  bus: string;
  departure: string;
  status: string;
  color: string;
  capacity: number;
};

export type TransportRoutesSource = "mappoint2026" | "manual";

export type TransportBoardPayload = {
  coreStops: Record<number, TransportRouteStop[]>;
  routeMeta: TransportRouteMeta[];
  unplottedCampers: TransportUnplottedCamper[];
  /** True after explicit MapPoint apply or manual routing for this season. */
  routesConfigured?: boolean;
  routesSeason?: string;
  routesSource?: TransportRoutesSource;
};

const normName = (name: string) => name.trim().toLowerCase();

export const countTransportBoardStops = (stops: Record<number, TransportRouteStop[]>) =>
  Object.values(stops).reduce((sum, arr) => sum + (arr?.length || 0), 0);

/** Drop auto-created empty route shells (e.g. legacy 38-bus placeholder boards). */
export function stripEmptyRouteShell(payload: TransportBoardPayload): TransportBoardPayload {
  if (countTransportBoardStops(payload.coreStops) > 0) return payload;
  if (payload.routeMeta.length === 0) return payload;
  return { ...payload, coreStops: {}, routeMeta: [] };
}

/** Ensure unplotted campers match enrolled roster for the active season. */
export async function normalizeTransportBoardForSeason(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  payload: TransportBoardPayload,
): Promise<TransportBoardPayload> {
  let board: TransportBoardPayload = { ...payload };

  // 2027+ default: no routes until explicitly configured (MapPoint apply or manual routing).
  const routesAllowed =
    season === "2026"
    || (board.routesConfigured === true && board.routesSeason === season);

  if (!routesAllowed) {
    board = {
      ...board,
      coreStops: {},
      routeMeta: [],
      unplottedCampers: board.unplottedCampers ?? [],
      routesConfigured: undefined,
      routesSeason: undefined,
      routesSource: undefined,
    };
  }

  board = stripEmptyRouteShell(board);

  const enrolled = await loadEnrolledCampersForTransport(supabase, companyId, season);
  const hints = season !== "2026" ? buildMappoint2026AddressHints() : undefined;
  const unplottedCampers = buildUnplottedFromEnrollment({
    enrolled,
    coreStops: board.coreStops,
    existingUnplotted: board.unplottedCampers,
    addressHints: hints,
  });

  return { ...board, unplottedCampers };
}

/** Strip unconfigured routes before persisting (2027+ safety). */
export function prepareBoardForPersist(
  payload: TransportBoardPayload,
  season: string,
): TransportBoardPayload {
  const hasRoutes = countTransportBoardStops(payload.coreStops) > 0 && payload.routeMeta.length > 0;

  if (!hasRoutes) {
    return {
      ...payload,
      routesConfigured: undefined,
      routesSeason: undefined,
      routesSource: undefined,
    };
  }

  if (season !== "2026" && !payload.routesConfigured) {
    return {
      ...payload,
      coreStops: {},
      routeMeta: [],
      routesConfigured: undefined,
      routesSeason: undefined,
      routesSource: undefined,
    };
  }

  return {
    ...payload,
    routesSeason: payload.routesConfigured ? season : payload.routesSeason,
  };
}

/** @deprecated Use prepareBoardForPersist */
export const markBoardRoutesForSeason = prepareBoardForPersist;

export function stableUnplottedId(seed: string, fallback: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h << 5) - h + seed.charCodeAt(i);
    h |= 0;
  }
  const n = Math.abs(h);
  return n > 0 ? n : fallback;
}

export async function loadEnrolledCampersForTransport(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
): Promise<TransportEnrolledCamper[]> {
  const { data, error } = await supabase
    .from("children")
    .select("id, name, age, session, grade, group_name")
    .eq("company_id", companyId)
    .eq("season", season)
    .neq("status", "inactive")
    .order("name");

  if (error) {
    console.error("[Transport] Load enrolled campers failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => ({
    id: row.id as string,
    name: (row.name as string)?.trim() ?? "",
    age: row.age as number | null,
    session: row.session as string | null,
    grade: row.grade as string | null,
    groupName: row.group_name as string | null,
  })).filter((c) => c.name);
}

/** Names currently assigned to any route stop. */
export function camperNamesOnBoard(coreStops: Record<number, TransportRouteStop[]>): Set<string> {
  const names = new Set<string>();
  for (const stops of Object.values(coreStops)) {
    for (const stop of stops ?? []) {
      for (const n of stop.camperNames?.length ? stop.camperNames : [stop.name]) {
        if (n.trim()) names.add(normName(n));
      }
    }
  }
  return names;
}

/** Build address hints from 2026 MapPoint CSV (historical learning — not auto-routing). */
export function buildMappoint2026AddressHints(): Map<string, { address: string; lat: number; lng: number }> {
  const routes = parseMappointRoutesCsv(getBundledMappointRoutesCsv2026(), { direction: "AM" });
  const hints = new Map<string, { address: string; lat: number; lng: number }>();

  for (const route of routes) {
    for (const stop of route.stops) {
      const geo = resolveBundledGeocodeResult(stop.address);
      if (!geo) continue;
      for (const camperName of stop.camperNames) {
        const key = normName(camperName);
        if (!key || hints.has(key)) continue;
        hints.set(key, { address: stop.address, lat: geo.lat, lng: geo.lng });
      }
    }
  }

  return hints;
}

export function buildUnplottedFromEnrollment(options: {
  enrolled: TransportEnrolledCamper[];
  coreStops: Record<number, TransportRouteStop[]>;
  existingUnplotted?: TransportUnplottedCamper[];
  addressHints?: Map<string, { address: string; lat: number; lng: number }>;
}): TransportUnplottedCamper[] {
  const { enrolled, coreStops, existingUnplotted = [], addressHints } = options;
  const onBoard = camperNamesOnBoard(coreStops);
  const existingByName = new Map(existingUnplotted.map((c) => [normName(c.name), c]));

  const out: TransportUnplottedCamper[] = [];
  enrolled.forEach((child, index) => {
    const key = normName(child.name);
    if (onBoard.has(key)) return;

    const kept = existingByName.get(key);
    if (kept) {
      out.push(kept);
      return;
    }

    const hint = addressHints?.get(key);
    out.push({
      id: stableUnplottedId(child.id, index + 1),
      name: child.name,
      address: hint?.address ?? "",
      lat: hint?.lat ?? 0,
      lng: hint?.lng ?? 0,
      age: child.age ?? 10,
      session: child.session ?? child.grade ?? "",
    });
  });

  return out.sort((a, b) => a.name.localeCompare(b.name));
}

/** Stops-only route template from 2026 MapPoint — no camper names on routes. */
export function build2026MappointRouteTemplate(routeColors: string[]): {
  coreStops: Record<number, TransportRouteStop[]>;
  routeMeta: TransportRouteMeta[];
} {
  const routes = parseMappointRoutesCsv(getBundledMappointRoutesCsv2026(), { direction: "AM" });
  return buildRouteTemplateFromParsedRoutes(routes, routeColors);
}

export function buildRouteTemplateFromParsedRoutes(
  routes: ParsedMappointRoute[],
  routeColors: string[],
): {
  coreStops: Record<number, TransportRouteStop[]>;
  routeMeta: TransportRouteMeta[];
} {
  const coreStops: Record<number, TransportRouteStop[]> = {};
  const routeMeta: TransportRouteMeta[] = [];

  for (const route of routes) {
    const stops: TransportRouteStop[] = [];
    for (const stop of route.stops) {
      const geo = resolveBundledGeocodeResult(stop.address);
      if (!geo) continue;
      stops.push({
        name: stop.label,
        address: stop.address,
        lat: geo.lat,
        lng: geo.lng,
        pickupTime: "",
        passengers: 0,
        camperNames: [],
      });
    }
    if (!stops.length) continue;

    coreStops[route.busNumber] = stops;
    routeMeta.push({
      id: route.busNumber,
      name: `${route.routeName} · Bus ${route.busNumber}`,
      bus: route.busCounselor
        ? `Bus ${route.busNumber} (${route.busCounselor})`
        : `Bus ${route.busNumber}`,
      departure: "7:00 AM",
      status: "Confirmed",
      color: routeColors[(route.busNumber - 1) % routeColors.length],
      capacity: 22,
    });
  }

  return { coreStops, routeMeta };
}

/** Load a prior season board and strip camper assignments (stops-only template). */
export async function loadStopsOnlyTemplateFromSeason(
  supabase: SupabaseClient,
  companyId: string,
  fromSeason: string,
  routeColors: string[],
): Promise<{ coreStops: Record<number, TransportRouteStop[]>; routeMeta: TransportRouteMeta[] } | null> {
  const { data, error } = await supabase
    .from("transport_boards")
    .select("data")
    .eq("company_id", companyId)
    .eq("season", fromSeason)
    .maybeSingle();

  if (error || !data?.data || typeof data.data !== "object") return null;

  const saved = data.data as {
    coreStops?: Record<number, TransportRouteStop[]>;
    routeMeta?: TransportRouteMeta[];
  };

  if (!saved.coreStops || !saved.routeMeta?.length) return null;

  const coreStops: Record<number, TransportRouteStop[]> = {};
  for (const [k, stops] of Object.entries(saved.coreStops)) {
    coreStops[Number(k)] = (stops as TransportRouteStop[]).map((s) => ({
      ...s,
      name: s.address.split(",")[0]?.trim() || s.name,
      passengers: 0,
      camperNames: [],
    }));
  }

  const routeMeta = saved.routeMeta.map((r, i) => ({
    ...r,
    id: Number(r.id),
    color: r.color || routeColors[i % routeColors.length],
  }));

  return { coreStops, routeMeta };
}
