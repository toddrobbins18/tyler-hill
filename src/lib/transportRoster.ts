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
import { fetchCompanySlug, isSandboxTransportSlug } from "@/lib/nestSandboxTransport";
import {
  consolidateRouteStopsByAddress,
  riderNamesFromStop,
} from "@/lib/transportRouteStops";

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
  const enrolledNames = new Set(enrolled.map((c) => normName(c.name)));
  const prunedStops = pruneCoreStopsToSeasonRoster(board.coreStops, enrolledNames);

  const unplottedCampers = filterUnplottedExcludingParentTransport(
    buildUnplottedFromEnrollment({
      enrolled,
      coreStops: prunedStops,
      existingUnplotted: board.unplottedCampers,
      addressHints: hints,
    }),
    parentTransportCampers,
  );

  return { ...board, coreStops: prunedStops, parentTransportCampers, unplottedCampers };
}

/** True when season normalize changed stored stops or unplotted (ghost riders removed). */
export function transportBoardSeasonSyncChanged(
  before: TransportBoardPayload,
  after: TransportBoardPayload,
): boolean {
  if (JSON.stringify(before.coreStops) !== JSON.stringify(after.coreStops)) return true;
  const unplottedKey = (p: TransportBoardPayload) =>
    p.unplottedCampers
      .map((c) => c.name.trim().toLowerCase())
      .sort()
      .join("\0");
  return unplottedKey(before) !== unplottedKey(after);
}

/** Strip prior-season / MapPoint ghost riders; keep open stops (no names). */
export function pruneCoreStopsToSeasonRoster(
  coreStops: Record<number, TransportRouteStop[]>,
  enrolledNames: Set<string>,
): Record<number, TransportRouteStop[]> {
  const out: Record<number, TransportRouteStop[]> = {};
  for (const [routeId, stops] of Object.entries(coreStops)) {
    out[Number(routeId)] = (stops ?? []).map((stop) => {
      const riders = riderNamesFromStop(stop).filter((name) => enrolledNames.has(normName(name)));
      if (riders.length === 0) {
        return {
          ...stop,
          camperNames: [],
          passengers: 0,
          name: stop.address.split(",")[0]?.trim() || stop.name,
        };
      }
      return {
        ...stop,
        camperNames: riders,
        passengers: riders.length,
        name: riders[0] ?? stop.name,
      };
    });
  }
  return out;
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

const normAddressCompareKey = (address: string) =>
  address.trim().toLowerCase().replace(/\s+/g, " ");

function stopLabelForRiders(names: string[]): string {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  return `${names[0]} +${names.length - 1}`;
}

function buildRouteStopForRiders(
  template: TransportRouteStop,
  names: string[],
  address: string,
): TransportRouteStop {
  const addressChanged =
    normAddressCompareKey(address) !== normAddressCompareKey(template.address || "");
  const bundled = resolveBundledGeocodeResult(address);
  let lat = template.lat;
  let lng = template.lng;
  if (addressChanged) {
    lat = bundled?.lat ?? 0;
    lng = bundled?.lng ?? 0;
  } else if (!isValidRouteCoordinate(lat, lng) && bundled) {
    lat = bundled.lat;
    lng = bundled.lng;
  }

  if (names.length === 0) {
    return {
      ...template,
      address,
      lat,
      lng,
    };
  }

  return {
    ...template,
    address,
    lat,
    lng,
    camperNames: names,
    passengers: names.length,
    name: stopLabelForRiders(names),
  };
}

/** Split shared stops when riders have different CampMinder home addresses. */
function fixRouteStopAddressesFromEnrollment(
  stop: TransportRouteStop,
  addressByName: Map<string, string>,
): { stops: TransportRouteStop[]; fixedStopCount: number; splitFromOne: boolean } {
  const names = riderNamesFromStop(stop);
  if (names.length === 0) {
    return { stops: [stop], fixedStopCount: 0, splitFromOne: false };
  }

  const stopKey = normAddressCompareKey(stop.address || "");
  const byAddress = new Map<string, { address: string; names: string[] }>();
  const noEnrollment: string[] = [];

  for (const rawName of names) {
    const correct = addressByName.get(normName(rawName));
    if (!correct) {
      noEnrollment.push(rawName);
      continue;
    }
    const key = normAddressCompareKey(correct);
    const bucket = byAddress.get(key);
    if (bucket) bucket.names.push(rawName);
    else byAddress.set(key, { address: correct, names: [rawName] });
  }

  if (byAddress.size === 0) {
    return { stops: [stop], fixedStopCount: 0, splitFromOne: false };
  }

  if (byAddress.size === 1 && noEnrollment.length === 0 && names.length === 1) {
    const only = [...byAddress.values()][0];
    if (normAddressCompareKey(only.address) === stopKey) {
      return { stops: [stop], fixedStopCount: 0, splitFromOne: false };
    }
    return {
      stops: [buildRouteStopForRiders(stop, only.names, only.address)],
      fixedStopCount: 1,
      splitFromOne: false,
    };
  }

  const out: TransportRouteStop[] = [];
  let fixedStopCount = 0;
  for (const { address, names: groupNames } of byAddress.values()) {
    if (normAddressCompareKey(address) !== stopKey) fixedStopCount += groupNames.length;
    out.push(buildRouteStopForRiders(stop, groupNames, address));
  }
  if (noEnrollment.length > 0) {
    out.push(buildRouteStopForRiders(stop, noEnrollment, stop.address || ""));
  }

  const splitFromOne = out.length > 1;
  if (splitFromOne && fixedStopCount === 0) {
    fixedStopCount = names.filter((n) => {
      const correct = addressByName.get(normName(n));
      return correct && normAddressCompareKey(correct) !== stopKey;
    }).length;
  }

  return { stops: out, fixedStopCount, splitFromOne };
}

/** Replace stale route/unplotted addresses with children.home_address (CampMinder). */
export function fixBoardAddressesFromEnrollment(options: {
  enrolled: TransportEnrolledCamper[];
  coreStops: Record<number, TransportRouteStop[]>;
  unplottedCampers: TransportUnplottedCamper[];
}): {
  coreStops: Record<number, TransportRouteStop[]>;
  unplottedCampers: TransportUnplottedCamper[];
  fixedStopCount: number;
  fixedUnplottedCount: number;
  splitStopCount: number;
} {
  const addressByName = new Map<string, string>();
  for (const camper of options.enrolled) {
    const address = camper.homeAddress?.trim();
    if (address) addressByName.set(normName(camper.name), address);
  }

  let fixedStopCount = 0;
  let splitStopCount = 0;
  const coreStops: Record<number, TransportRouteStop[]> = {};
  for (const [routeId, stops] of Object.entries(options.coreStops)) {
    const expanded: TransportRouteStop[] = [];
    for (const stop of stops ?? []) {
      const fixed = fixRouteStopAddressesFromEnrollment(stop, addressByName);
      fixedStopCount += fixed.fixedStopCount;
      if (fixed.splitFromOne) splitStopCount += 1;
      expanded.push(...fixed.stops);
    }
    coreStops[Number(routeId)] = consolidateRouteStopsByAddress(expanded);
  }

  let fixedUnplottedCount = 0;
  const unplottedCampers = options.unplottedCampers.map((camper) => {
    const correct = addressByName.get(normName(camper.name));
    if (!correct || normAddressCompareKey(correct) === normAddressCompareKey(camper.address || "")) {
      return camper;
    }
    fixedUnplottedCount += 1;
    const bundled = resolveBundledGeocodeResult(correct);
    return {
      ...camper,
      address: correct,
      lat: bundled?.lat ?? 0,
      lng: bundled?.lng ?? 0,
    };
  });

  return {
    coreStops,
    unplottedCampers,
    fixedStopCount,
    fixedUnplottedCount,
    splitStopCount,
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
  const slug = await fetchCompanySlug(supabase, companyId);
  if (isSandboxTransportSlug(slug)) {
    return new Map();
  }

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
      const address = syncedAddress || kept.address?.trim() || hint?.address || "";
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
