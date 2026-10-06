import type { SupabaseClient } from "@supabase/supabase-js";
import { resolvePersonAge } from "@/lib/birthdayCalendar";
import {
  DEFAULT_TRANSPORT_BOARD_SETTINGS,
  normalizeTransportBoardSettings,
  type TransportBoardSettings,
} from "@/lib/transportBoardSettings";
import { isValidRouteCoordinate } from "@/lib/transportStopTimes";
import {
  filterUnplottedExcludingParentTransport,
  type ParentTransportCamper,
} from "@/lib/transportParentTransport";
import {
  getBundledMappointAddressesCsv2026,
  getBundledMappointRoutesCsv2026,
  parseMappointAddressesCsv,
  parseMappointRoutesCsv,
  resolveBundledGeocodeResult,
  type ParsedMappointRoute,
} from "@/lib/mappointTransportImport";
import {
  buildAddressHintsFromPriors,
  expandMappointCamperNames,
  loadCamperRoutingPriors,
  loadRouteReferenceImport,
  normCamperNameKey,
} from "@/lib/routeReferenceWarehouse";

export type TransportEnrolledCamper = {
  id: string;
  personId: string | null;
  name: string;
  age: number | null;
  session: string | null;
  grade: string | null;
  groupName: string | null;
  homeAddress: string | null;
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
  /** Parent drop-off / pick-up — assigned to a bus for reporting, no map address. */
  parentTransportCampers?: ParentTransportCamper[];
  /** Global pickup-time setting for stop clock estimates (AM & PM). */
  settings?: TransportBoardSettings;
  /** True after explicit MapPoint apply or manual routing for this season. */
  routesConfigured?: boolean;
  routesSeason?: string;
  routesSource?: TransportRoutesSource;
  /** 2027+ sandbox — test moves without treating board as final. */
  routesDraftMode?: boolean;
  /** User confirmed routes are ready (exits draft). */
  routesConfirmed?: boolean;
};

export { DEFAULT_TRANSPORT_BOARD_SETTINGS, normalizeTransportBoardSettings, type TransportBoardSettings };

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
  // MapPoint 2026 priors fill gaps when CampMinder sync has no household address yet.
  const hints = await loadHistoricalAddressHints(supabase, companyId, "2026");
  const parentTransportCampers = board.parentTransportCampers ?? [];
  const unplottedCampers = filterUnplottedExcludingParentTransport(
    buildUnplottedFromEnrollment({
      enrolled,
      coreStops: board.coreStops,
      existingUnplotted: board.unplottedCampers,
      addressHints: hints,
    }),
    parentTransportCampers,
  );

  return { ...board, parentTransportCampers, unplottedCampers };
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

const TRANSPORT_ROSTER_PAGE_SIZE = 1000;

export async function loadEnrolledCampersForTransport(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
): Promise<TransportEnrolledCamper[]> {
  const rows: Record<string, unknown>[] = [];
  let from = 0;

  for (;;) {
    const to = from + TRANSPORT_ROSTER_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("children")
      .select("id, person_id, name, age, date_of_birth, session, grade, group_name, home_address")
      .eq("company_id", companyId)
      .eq("season", season)
      .neq("status", "inactive")
      .order("name")
      .range(from, to);

    if (error) {
      console.error("[Transport] Load enrolled campers failed:", error.message);
      return [];
    }

    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < TRANSPORT_ROSTER_PAGE_SIZE) break;
    from += TRANSPORT_ROSTER_PAGE_SIZE;
  }

  const enrolled = rows.map((row) => ({
    id: row.id as string,
    personId: (row.person_id as string | null) ?? null,
    name: (row.name as string)?.trim() ?? "",
    age: resolvePersonAge(row.date_of_birth, row.age),
    session: row.session as string | null,
    grade: row.grade as string | null,
    groupName: row.group_name as string | null,
    homeAddress: (row.home_address as string | null)?.trim() || null,
  })).filter((c) => c.name);

  return enrichEnrolledHomeAddresses(supabase, companyId, season, enrolled);
}

/** Fill blank home_address from prior seasons (same person_id). */
async function enrichEnrolledHomeAddresses(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  enrolled: TransportEnrolledCamper[],
): Promise<TransportEnrolledCamper[]> {
  const missingPersonIds = [
    ...new Set(
      enrolled
        .filter((c) => !c.homeAddress && c.personId)
        .map((c) => c.personId as string),
    ),
  ];
  if (missingPersonIds.length === 0) return enrolled;

  const { data: historical } = await supabase
    .from("children")
    .select("person_id, home_address, season")
    .eq("company_id", companyId)
    .in("person_id", missingPersonIds)
    .neq("season", season)
    .order("season", { ascending: false });

  const addressByPerson = new Map<string, string>();
  for (const row of historical ?? []) {
    const personId = row.person_id as string | null;
    const address = (row.home_address as string | null)?.trim();
    if (personId && address && !addressByPerson.has(personId)) {
      addressByPerson.set(personId, address);
    }
  }

  if (addressByPerson.size === 0) return enrolled;

  return enrolled.map((camper) => {
    if (camper.homeAddress || !camper.personId) return camper;
    const fallback = addressByPerson.get(camper.personId);
    return fallback ? { ...camper, homeAddress: fallback } : camper;
  });
}

const normAddressKey = (address: string) => address.trim().toLowerCase();

/** Unique addresses on the board that still need lat/lng before map plotting. */
export function collectTransportAddressesNeedingGeocode(
  unplotted: TransportUnplottedCamper[],
  coreStops: Record<number, TransportRouteStop[]>,
  campAddress: string,
): string[] {
  const addresses = new Set<string>();

  for (const camper of unplotted) {
    const address = camper.address?.trim();
    if (address && !isValidRouteCoordinate(camper.lat, camper.lng)) {
      addresses.add(address);
    }
  }

  for (const stops of Object.values(coreStops)) {
    for (const stop of stops ?? []) {
      const address = stop.address?.trim();
      if (
        address
        && address !== campAddress
        && !isValidRouteCoordinate(stop.lat, stop.lng)
      ) {
        addresses.add(address);
      }
    }
  }

  return [...addresses];
}

export function applyGeocodeResultsToTransportBoard(
  unplotted: TransportUnplottedCamper[],
  coreStops: Record<number, TransportRouteStop[]>,
  resultsByAddress: Map<string, { lat: number; lng: number }>,
  campAddress: string,
): {
  unplotted: TransportUnplottedCamper[];
  coreStops: Record<number, TransportRouteStop[]>;
  updatedCount: number;
} {
  let updatedCount = 0;

  const nextUnplotted = unplotted.map((camper) => {
    const geo = resultsByAddress.get(normAddressKey(camper.address));
    if (!geo || isValidRouteCoordinate(camper.lat, camper.lng)) return camper;
    updatedCount += 1;
    return { ...camper, lat: geo.lat, lng: geo.lng };
  });

  const nextCoreStops: Record<number, TransportRouteStop[]> = {};
  for (const [routeId, stops] of Object.entries(coreStops)) {
    nextCoreStops[Number(routeId)] = (stops ?? []).map((stop) => {
      const geo = resultsByAddress.get(normAddressKey(stop.address));
      if (
        !geo
        || stop.address === campAddress
        || isValidRouteCoordinate(stop.lat, stop.lng)
      ) {
        return stop;
      }
      updatedCount += 1;
      return { ...stop, lat: geo.lat, lng: geo.lng };
    });
  }

  return {
    unplotted: nextUnplotted,
    coreStops: nextCoreStops,
    updatedCount,
  };
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

type AddressHint = { address: string; lat: number; lng: number };

function registerMappointAddressHint(
  hints: Map<string, AddressHint>,
  rawName: string,
  address: string,
) {
  const trimmedAddress = address.trim();
  if (!trimmedAddress) return;
  const geo = resolveBundledGeocodeResult(trimmedAddress);
  for (const expanded of expandMappointCamperNames(rawName)) {
    const key = normCamperNameKey(expanded);
    if (!key || hints.has(key)) continue;
    hints.set(key, {
      address: trimmedAddress,
      lat: geo?.lat ?? 0,
      lng: geo?.lng ?? 0,
    });
  }
}

/** Load camper→address hints from warehouse (falls back to bundled 2026 CSV). */
export async function loadHistoricalAddressHints(
  supabase: SupabaseClient,
  companyId: string,
  referenceSeason = "2026",
): Promise<Map<string, AddressHint>> {
  const bundled = buildMappoint2026AddressHints();
  const importRecord = await loadRouteReferenceImport(supabase, companyId, referenceSeason);
  if (!importRecord) return bundled;

  const priors = await loadCamperRoutingPriors(supabase, companyId, {
    referenceSeason,
    direction: "AM",
  });
  if (!priors.length) return bundled;

  const hints = new Map<string, AddressHint>();
  for (const [key, value] of buildAddressHintsFromPriors(priors)) {
    hints.set(key, { address: value.address, lat: value.lat, lng: value.lng });
  }
  for (const [key, value] of bundled) {
    if (!hints.has(key)) hints.set(key, value);
  }
  return hints;
}

/** Build address hints from 2026 MapPoint routes + addresses CSV (historical learning). */
export function buildMappoint2026AddressHints(): Map<string, AddressHint> {
  const hints = new Map<string, AddressHint>();

  const routes = parseMappointRoutesCsv(getBundledMappointRoutesCsv2026(), { direction: "AM" });
  for (const route of routes) {
    for (const stop of route.stops) {
      for (const camperName of stop.camperNames) {
        registerMappointAddressHint(hints, camperName, stop.address);
      }
    }
  }

  for (const row of parseMappointAddressesCsv(getBundledMappointAddressesCsv2026())) {
    registerMappointAddressHint(hints, row.name, row.address);
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

    const resolvedAge = child.age ?? null;
    const kept = existingByName.get(key);
    const hint = addressHints?.get(key);
    const syncedAddress = child.homeAddress?.trim() || "";
    if (kept) {
      const address = kept.address?.trim() || syncedAddress || hint?.address || "";
      const bundled = address ? resolveBundledGeocodeResult(address) : null;
      out.push({
        ...kept,
        address,
        lat: kept.lat || bundled?.lat || hint?.lat || 0,
        lng: kept.lng || bundled?.lng || hint?.lng || 0,
        age: resolvedAge ?? kept.age,
        session: child.session ?? child.grade ?? kept.session,
      });
      return;
    }

    const address = syncedAddress || hint?.address || "";
    const bundled = address ? resolveBundledGeocodeResult(address) : null;
    out.push({
      id: stableUnplottedId(child.id, index + 1),
      name: child.name,
      address,
      lat: bundled?.lat ?? hint?.lat ?? 0,
      lng: bundled?.lng ?? hint?.lng ?? 0,
      age: resolvedAge ?? 10,
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
