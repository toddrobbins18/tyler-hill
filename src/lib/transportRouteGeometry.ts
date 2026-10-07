import type { SupabaseClient } from "@supabase/supabase-js";

export type LatLng = [number, number];

/** Only successful road paths are cached — failed lookups can be retried. */
const successCache = new Map<string, LatLng[]>();
const inflightRequests = new Map<string, Promise<LatLng[] | null>>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (!items.length) return;
  let nextIndex = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex++;
      await worker(items[index]);
    }
  });
  await Promise.all(runners);
}

export function routeGeometryCacheKey(coordsLngLat: [number, number][]): string {
  return coordsLngLat.map(([lng, lat]) => `${lng.toFixed(5)},${lat.toFixed(5)}`).join("|");
}

export function mergeRoadLegGeometries(legs: LatLng[][]): LatLng[] {
  const merged: LatLng[] = [];
  for (const leg of legs) {
    if (leg.length < 2) continue;
    if (!merged.length) merged.push(...leg);
    else merged.push(...leg.slice(1));
  }
  return merged;
}

function readCachedPath(key: string): LatLng[] | undefined {
  return successCache.get(key);
}

export function readCachedRoadPath(key: string): LatLng[] | undefined {
  return readCachedPath(key);
}

function storeCachedPath(key: string, path: LatLng[]) {
  if (path.length > 1) successCache.set(key, path);
}

/** OSRM — primary router (works in browser, no API key, follows roads). */
export async function fetchOsrmRoadGeometry(
  coordsLngLat: [number, number][],
): Promise<LatLng[] | null> {
  if (coordsLngLat.length < 2) return null;

  const coordStr = coordsLngLat.map(([lng, lat]) => `${lng},${lat}`).join(";");
  const url = `https://router.project-osrm.org/route/v1/driving/${coordStr}?overview=full&geometries=geojson`;

  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await sleep(400 * attempt);
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const data = (await response.json()) as {
        code?: string;
        routes?: { geometry?: { coordinates?: [number, number][] } }[];
      };
      if (data.code !== "Ok") continue;
      const coords = data.routes?.[0]?.geometry?.coordinates;
      if (!Array.isArray(coords) || coords.length < 2) continue;
      return coords.map(([lng, lat]) => [lat, lng] as LatLng);
    } catch {
      // retry
    }
  }

  return null;
}

async function fetchOrsRoadGeometry(
  supabase: SupabaseClient,
  coordsLngLat: [number, number][],
): Promise<LatLng[] | null> {
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(600);
    try {
      const { data, error } = await supabase.functions.invoke("route-optimizer", {
        body: {
          action: "directions",
          coordinates: coordsLngLat,
          includeGeometry: true,
        },
      });
      if (error) continue;
      const geometry = data?.geometry;
      if (Array.isArray(geometry) && geometry.length > 1) {
        return geometry as LatLng[];
      }
    } catch {
      // retry
    }
  }
  return null;
}

async function fetchRoadGeometryOnce(
  supabase: SupabaseClient,
  coordsLngLat: [number, number][],
  options?: { skipCache?: boolean },
): Promise<LatLng[] | null> {
  if (coordsLngLat.length < 2) return null;

  const key = routeGeometryCacheKey(coordsLngLat);
  if (!options?.skipCache) {
    const cached = readCachedPath(key);
    if (cached) return cached;
  }

  const osrm = await fetchOsrmRoadGeometry(coordsLngLat);
  if (osrm) {
    storeCachedPath(key, osrm);
    return osrm;
  }

  const ors = await fetchOrsRoadGeometry(supabase, coordsLngLat);
  if (ors) {
    storeCachedPath(key, ors);
    return ors;
  }

  return null;
}

/** Fetch road-following path; falls back to leg-by-leg routing if the full route fails. */
export async function fetchRoadRouteGeometry(
  supabase: SupabaseClient,
  coordsLngLat: [number, number][],
  options?: { skipCache?: boolean },
): Promise<LatLng[] | null> {
  if (coordsLngLat.length < 2) return null;

  const key = routeGeometryCacheKey(coordsLngLat);
  if (!options?.skipCache) {
    const cached = readCachedPath(key);
    if (cached) return cached;
  }

  const full = await fetchRoadGeometryOnce(supabase, coordsLngLat, options);
  if (full) return full;

  if (coordsLngLat.length === 2) return null;

  const legs: LatLng[][] = [];
  for (let i = 0; i < coordsLngLat.length - 1; i++) {
    const leg = await fetchRoadGeometryOnce(
      supabase,
      [coordsLngLat[i], coordsLngLat[i + 1]],
      options,
    );
    if (leg) legs.push(leg);
  }

  if (!legs.length) return null;

  const merged = mergeRoadLegGeometries(legs);
  if (merged.length < 2) return null;

  storeCachedPath(key, merged);
  return merged;
}

export async function fetchRoadRouteGeometryShared(
  supabase: SupabaseClient,
  coordsLngLat: [number, number][],
): Promise<LatLng[] | null> {
  if (coordsLngLat.length < 2) return null;

  const key = routeGeometryCacheKey(coordsLngLat);
  const cached = readCachedPath(key);
  if (cached) return cached;

  let pending = inflightRequests.get(key);
  if (!pending) {
    pending = fetchRoadRouteGeometry(supabase, coordsLngLat).finally(() => {
      inflightRequests.delete(key);
    });
    inflightRequests.set(key, pending);
  }
  return pending;
}

export async function fetchRoadGeometriesForRoutes(
  supabase: SupabaseClient,
  routes: { id: number; coords: [number, number][] }[],
  options?: {
    concurrency?: number;
    onRouteComplete?: (result: { id: number; path: LatLng[] | null }) => void;
  },
): Promise<Record<number, LatLng[] | null>> {
  const eligible = routes.filter((route) => route.coords.length >= 2);
  const out: Record<number, LatLng[] | null> = {};
  const concurrency = options?.concurrency ?? 4;

  await mapWithConcurrency(eligible, concurrency, async (route) => {
    const path = await fetchRoadRouteGeometryShared(supabase, route.coords);
    out[route.id] = path;
    options?.onRouteComplete?.({ id: route.id, path });
  });

  return out;
}

/** @internal test helper */
export function clearRouteGeometryCacheForTests() {
  successCache.clear();
  inflightRequests.clear();
}
