import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getBundledMappointRoutesCsv2026,
  parseMappointRoutesCsv,
  resolveBundledGeocodeResult,
} from "@/lib/mappointTransportImport";
import {
  buildCamperPriorMap,
  buildRouteReferenceFromMappointCsv,
  importRouteReference,
  loadCamperRoutingPriors,
  loadRouteReferenceImport,
  normCamperNameKey,
  type CamperRoutingPrior,
  type RouteReferenceImportStats,
} from "@/lib/routeReferenceWarehouse";
import type {
  TransportRouteMeta,
  TransportRouteStop,
  TransportUnplottedCamper,
} from "@/lib/transportRoster";

export const DEFAULT_REFERENCE_SEASON = "2026";

export type ApplyHistoricalResult = {
  coreStops: Record<number, TransportRouteStop[]>;
  unplottedCampers: TransportUnplottedCamper[];
  placed: { name: string; busNumber: number; address: string }[];
  skippedNoPrior: string[];
  skippedNoBus: { name: string; priorBus: number }[];
  skippedNoCoords: string[];
};

export type ReferenceDatasetStatus = {
  referenceSeason: string;
  loaded: boolean;
  source: "warehouse" | "bundled";
  stats: RouteReferenceImportStats | null;
  priorCount: number;
};

export function normAddressKey(address: string): string {
  return address.trim().toLowerCase();
}

export function normCamperName(name: string): string {
  return normCamperNameKey(name);
}

/** Build priors from bundled MapPoint CSV when warehouse is empty. */
export function buildPriorsFromBundledMappoint(
  referenceSeason = DEFAULT_REFERENCE_SEASON,
): CamperRoutingPrior[] {
  const routes = parseMappointRoutesCsv(getBundledMappointRoutesCsv2026(), { direction: "AM" });
  const priors: CamperRoutingPrior[] = [];

  for (const route of routes) {
    for (const stop of route.stops) {
      const geo = resolveBundledGeocodeResult(stop.address);
      for (const camperName of stop.camperNames) {
        priors.push({
          camperName,
          camperNameKey: normCamperNameKey(camperName),
          referenceSeason,
          busNumber: route.busNumber,
          routeName: route.routeName,
          direction: "AM",
          stopOrder: stop.stopOrder,
          address: stop.address,
          lat: geo?.lat ?? null,
          lng: geo?.lng ?? null,
          routeFile: route.routeFile,
        });
      }
    }
  }

  return priors;
}

export async function loadCamperPriorMap(
  supabase: SupabaseClient,
  companyId: string,
  referenceSeason = DEFAULT_REFERENCE_SEASON,
): Promise<Map<string, CamperRoutingPrior>> {
  const priors = await loadCamperRoutingPriors(supabase, companyId, {
    referenceSeason,
    direction: "AM",
  });

  if (priors.length > 0) {
    return buildCamperPriorMap(priors);
  }

  return buildCamperPriorMap(buildPriorsFromBundledMappoint(referenceSeason));
}

export async function getReferenceDatasetStatus(
  supabase: SupabaseClient,
  companyId: string,
  referenceSeason = DEFAULT_REFERENCE_SEASON,
): Promise<ReferenceDatasetStatus> {
  const importRecord = await loadRouteReferenceImport(supabase, companyId, referenceSeason);
  const priors = importRecord
    ? await loadCamperRoutingPriors(supabase, companyId, { referenceSeason, direction: "AM" })
    : [];

  if (importRecord && priors.length > 0) {
    return {
      referenceSeason,
      loaded: true,
      source: "warehouse",
      stats: importRecord.stats,
      priorCount: priors.length,
    };
  }

  const bundled = buildPriorsFromBundledMappoint(referenceSeason);
  return {
    referenceSeason,
    loaded: bundled.length > 0,
    source: "bundled",
    stats: null,
    priorCount: bundled.length,
  };
}

export async function syncBundledMapPointToWarehouse(
  supabase: SupabaseClient,
  companyId: string,
  options?: { userId?: string | null; referenceSeason?: string },
): Promise<{ ok: boolean; error?: string; stats?: RouteReferenceImportStats }> {
  const referenceSeason = options?.referenceSeason ?? DEFAULT_REFERENCE_SEASON;
  const payload = buildRouteReferenceFromMappointCsv(getBundledMappointRoutesCsv2026(), {
    referenceSeason,
    label: `MapPoint ${referenceSeason} (auto-sync)`,
    geocodeLookup: (address) => resolveBundledGeocodeResult(address),
  });

  const { importId, error } = await importRouteReference(supabase, companyId, payload, {
    userId: options?.userId,
    replace: true,
  });

  if (error || !importId) {
    return { ok: false, error: error ?? "Import failed" };
  }

  return { ok: true, stats: payload.stats };
}

export async function importMapPointCsvToWarehouse(
  supabase: SupabaseClient,
  companyId: string,
  csvText: string,
  options: { referenceSeason: string; label?: string; userId?: string | null },
): Promise<{ ok: boolean; error?: string; stats?: RouteReferenceImportStats }> {
  const payload = buildRouteReferenceFromMappointCsv(csvText, {
    referenceSeason: options.referenceSeason,
    label: options.label ?? `MapPoint ${options.referenceSeason}`,
    geocodeLookup: (address) => resolveBundledGeocodeResult(address),
  });

  if (payload.assignments.length === 0) {
    return { ok: false, error: "No valid camper assignments found in CSV" };
  }

  const { importId, error } = await importRouteReference(supabase, companyId, payload, {
    userId: options?.userId,
    replace: true,
  });

  if (error || !importId) {
    return { ok: false, error: error ?? "Import failed" };
  }

  return { ok: true, stats: payload.stats };
}

function cloneCoreStops(
  coreStops: Record<number, TransportRouteStop[]>,
): Record<number, TransportRouteStop[]> {
  const out: Record<number, TransportRouteStop[]> = {};
  for (const [key, stops] of Object.entries(coreStops)) {
    out[Number(key)] = (stops ?? []).map((s) => ({
      ...s,
      camperNames: s.camperNames ? [...s.camperNames] : undefined,
    }));
  }
  return out;
}

function insertStopByOrder(
  stops: TransportRouteStop[],
  stop: TransportRouteStop,
  stopOrder: number,
): TransportRouteStop[] {
  const next = [...stops];
  const idx =
    stopOrder > 0 ? Math.min(Math.max(0, stopOrder - 1), next.length) : next.length;
  next.splice(idx, 0, stop);
  return next;
}

function addCamperToStop(stop: TransportRouteStop, camperName: string): TransportRouteStop {
  const camperNames = [...(stop.camperNames ?? []), camperName];
  return {
    ...stop,
    camperNames,
    passengers: camperNames.length,
    name:
      camperNames.length === 1
        ? camperNames[0]
        : `${camperNames[0]} +${camperNames.length - 1}`,
  };
}

/**
 * Place unplotted campers onto their historical bus/stop using MapPoint priors.
 */
export function applyHistoricalAssignments(options: {
  coreStops: Record<number, TransportRouteStop[]>;
  routeMeta: TransportRouteMeta[];
  unplottedCampers: TransportUnplottedCamper[];
  priorMap: Map<string, CamperRoutingPrior>;
}): ApplyHistoricalResult {
  const { routeMeta, unplottedCampers, priorMap } = options;
  const coreStops = cloneCoreStops(options.coreStops);
  const busIds = new Set(routeMeta.map((r) => r.id));

  const placed: ApplyHistoricalResult["placed"] = [];
  const skippedNoPrior: string[] = [];
  const skippedNoBus: ApplyHistoricalResult["skippedNoBus"] = [];
  const skippedNoCoords: string[] = [];
  const remaining: TransportUnplottedCamper[] = [];

  for (const camper of unplottedCampers) {
    const prior = priorMap.get(`${normCamperNameKey(camper.name)}|AM`);
    if (!prior) {
      skippedNoPrior.push(camper.name);
      remaining.push(camper);
      continue;
    }

    if (!busIds.has(prior.busNumber)) {
      skippedNoBus.push({ name: camper.name, priorBus: prior.busNumber });
      remaining.push(camper);
      continue;
    }

    const lat = camper.lat || prior.lat || 0;
    const lng = camper.lng || prior.lng || 0;
    const address = camper.address || prior.address;

    if (!address || (lat === 0 && lng === 0)) {
      skippedNoCoords.push(camper.name);
      remaining.push(camper);
      continue;
    }

    const stops = coreStops[prior.busNumber] ?? [];
    const addrKey = normAddressKey(address);
    const stopIdx = stops.findIndex((s) => normAddressKey(s.address) === addrKey);

    if (stopIdx >= 0) {
      stops[stopIdx] = addCamperToStop(stops[stopIdx], camper.name);
    } else {
      const newStop: TransportRouteStop = {
        name: address.split(",")[0]?.trim() || camper.name,
        address,
        lat,
        lng,
        pickupTime: "",
        passengers: 1,
        camperNames: [camper.name],
      };
      coreStops[prior.busNumber] = insertStopByOrder(stops, newStop, prior.stopOrder);
    }

    placed.push({ name: camper.name, busNumber: prior.busNumber, address });
  }

  return {
    coreStops,
    unplottedCampers: remaining,
    placed,
    skippedNoPrior,
    skippedNoBus,
    skippedNoCoords,
  };
}

/** Prior-aware bus pick for unplotted campers (optimization fallback). */
export function pickHistoricalBusForCamper(
  camper: TransportUnplottedCamper,
  priorMap: Map<string, CamperRoutingPrior>,
  routeMeta: TransportRouteMeta[],
): number | undefined {
  const prior = priorMap.get(`${normCamperNameKey(camper.name)}|AM`);
  if (!prior) return undefined;
  if (!routeMeta.some((r) => r.id === prior.busNumber)) return undefined;
  return prior.busNumber;
}

/** Sort stops on each route using historical stop_order when available. */
export function reorderStopsByHistoricalPriors(
  coreStops: Record<number, TransportRouteStop[]>,
  priorMap: Map<string, CamperRoutingPrior>,
): Record<number, TransportRouteStop[]> {
  const out = cloneCoreStops(coreStops);

  for (const [busKey, stops] of Object.entries(out)) {
    const busNumber = Number(busKey);
    if (!stops?.length) continue;

    const orderForStop = (stop: TransportRouteStop): number => {
      let best = Number.MAX_SAFE_INTEGER;
      for (const name of stop.camperNames?.length ? stop.camperNames : [stop.name]) {
        const prior = priorMap.get(`${normCamperNameKey(name)}|AM`);
        if (prior && prior.busNumber === busNumber && prior.stopOrder > 0) {
          best = Math.min(best, prior.stopOrder);
        }
      }
      return best;
    };

    out[busNumber] = [...stops].sort((a, b) => orderForStop(a) - orderForStop(b));
  }

  return out;
}
