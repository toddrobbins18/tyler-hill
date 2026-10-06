import { isValidRouteCoordinate } from "@/lib/transportStopTimes";

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

/** Fetch driving leg durations (stop[i] → stop[i+1]) via route-optimizer / ORS. */
export async function fetchRouteLegDurationsSec(
  invoke: (body: { action: "legDurations"; coordinates: [number, number][] }) => Promise<{ data: LegDurationsResponse | null; error: Error | null }>,
  coordinates: [number, number][],
): Promise<number[] | null> {
  if (coordinates.length < 2) return [];

  const { data, error } = await invoke({
    action: "legDurations",
    coordinates,
  });

  if (error || data?.error) return null;

  const legs = data?.legDurationsSec;
  if (!Array.isArray(legs) || legs.length !== coordinates.length - 1) return null;

  return legs;
}
