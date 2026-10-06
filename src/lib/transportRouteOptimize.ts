import type { TransportRouteStop } from "@/lib/transportRoster";
import { haversineMiles, isValidRouteCoordinate } from "@/lib/transportStopTimes";

/**
 * Re-order stops 2…N for shortest drive starting at stop #1 (stop #1 stays fixed).
 * Used when a counselor manually moves their first pickup to the top of the list.
 */
export function optimizeStopsFromFirstStop(stops: TransportRouteStop[]): TransportRouteStop[] {
  if (stops.length <= 1) return [...stops];

  const [first, ...rest] = stops.filter((s) => isValidRouteCoordinate(s.lat, s.lng));
  if (!first) return [...stops];
  if (rest.length === 0) return [first];

  const remaining = [...rest];
  const ordered: TransportRouteStop[] = [];
  let curLat = first.lat;
  let curLng = first.lng;

  while (remaining.length) {
    let bestIdx = 0;
    let bestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const d = haversineMiles(curLat, curLng, remaining[i].lat, remaining[i].lng);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    const next = remaining.splice(bestIdx, 1)[0];
    ordered.push(next);
    curLat = next.lat;
    curLng = next.lng;
  }

  const invalid = stops.filter((s) => !isValidRouteCoordinate(s.lat, s.lng));
  return [first, ...ordered, ...invalid];
}
