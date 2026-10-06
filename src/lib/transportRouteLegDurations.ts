import { estimateDrivingLegMinutes, isValidRouteCoordinate } from "@/lib/transportStopTimes";

type LegDurationsResponse = {
  legDurationsSec?: number[];
  error?: string;
  warning?: string;
};

/** Stable cache key from ordered stop coordinates. */
export function routeStopCoordinateSignature(
  stops: { lat: number; lng: number }[],
): string {
  return stops
    .filter((s) => isValidRouteCoordinate(s.lat, s.lng))
    .map((s) => `${s.lat.toFixed(5)},${s.lng.toFixed(5)}`)
    .join("|");
}

export function legDurationsSecToMinutes(sec: number[]): number[] {
  return sec.map((s) => Math.max(0, s) / 60);
}

/** Local fallback when ORS leg durations are unavailable — prevents infinite retries. */
export function haversineLegMinutesFromCoords(coordinates: [number, number][]): number[] {
  const legs: number[] = [];
  for (let i = 1; i < coordinates.length; i++) {
    const [lng1, lat1] = coordinates[i - 1];
    const [lng2, lat2] = coordinates[i];
    legs.push(estimateDrivingLegMinutes(lat1, lng1, lat2, lng2));
  }
  return legs;
}

/** Fetch driving leg durations (stop[i] → stop[i+1]) via route-optimizer / ORS. */
export async function fetchRouteLegDurationsSec(
  invoke: (body: { action: "legDurations"; coordinates: [number, number][] }) => Promise<{ data: LegDurationsResponse | null; error: Error | null }>,
  coordinates: [number, number][],
): Promise<number[]> {
  if (coordinates.length < 2) return [];

  const fallback = () => haversineLegMinutesFromCoords(coordinates);

  try {
    const { data, error } = await invoke({
      action: "legDurations",
      coordinates,
    });

    if (error || data?.error) return fallback();

    const legs = data?.legDurationsSec;
    if (!Array.isArray(legs) || legs.length !== coordinates.length - 1 || legs.every((s) => s === 0)) {
      return fallback();
    }

    return legs;
  } catch {
    return fallback();
  }
}
