import { normalizeTransportAddress } from "@/lib/transportAddressNormalize";
import { isValidRouteCoordinate } from "@/lib/transportStopTimes";
import type { TransportRouteStop } from "@/lib/transportRoster";

function riderNamesFromStop(stop: TransportRouteStop): string[] {
  const names = (stop.camperNames ?? []).filter(Boolean);
  if (names.length > 0) return names;

  if ((stop.passengers ?? 0) > 0 && stop.name?.trim()) {
    const n = stop.name.trim();
    if (!n.includes(" kids at ") && !/^open stop/i.test(n)) {
      return [n];
    }
  }
  return [];
}

function mergeTwoStops(a: TransportRouteStop, b: TransportRouteStop): TransportRouteStop {
  const namesA = riderNamesFromStop(a);
  const namesB = riderNamesFromStop(b);
  const mergedNames: string[] = [...namesA];
  for (const name of namesB) {
    if (!mergedNames.some((existing) => existing.trim().toLowerCase() === name.trim().toLowerCase())) {
      mergedNames.push(name);
    }
  }

  const aHasRiders = namesA.length > 0;
  const bHasRiders = namesB.length > 0;
  const prefer = bHasRiders && !aHasRiders ? b : a;
  const other = prefer === a ? b : a;

  const lat = isValidRouteCoordinate(prefer.lat, prefer.lng)
    ? prefer.lat
    : isValidRouteCoordinate(other.lat, other.lng)
      ? other.lat
      : prefer.lat;
  const lng = isValidRouteCoordinate(prefer.lat, prefer.lng)
    ? prefer.lng
    : isValidRouteCoordinate(other.lat, other.lng)
      ? other.lng
      : prefer.lng;

  const address =
    (prefer.address?.trim() && riderNamesFromStop(prefer).length > 0 ? prefer.address : null)
    ?? (other.address?.trim() && riderNamesFromStop(other).length > 0 ? other.address : null)
    ?? prefer.address?.trim()
    ?? other.address?.trim()
    ?? "";

  if (mergedNames.length === 0) {
    return {
      ...prefer,
      address,
      lat,
      lng,
      passengers: 0,
      camperNames: [],
      name: address.split(",")[0]?.trim() || address || prefer.name,
      pickupTime: prefer.pickupTime || other.pickupTime || "",
    };
  }

  return {
    ...prefer,
    address,
    lat,
    lng,
    passengers: mergedNames.length,
    camperNames: mergedNames,
    name:
      mergedNames.length === 1
        ? mergedNames[0]
        : `${mergedNames[0]} +${mergedNames.length - 1}`,
    pickupTime: prefer.pickupTime || other.pickupTime || "",
  };
}

/** Merge duplicate addresses on a route (template stop + camper stop at same address). */
export function consolidateRouteStopsByAddress(stops: TransportRouteStop[]): TransportRouteStop[] {
  const order: string[] = [];
  const byKey = new Map<string, TransportRouteStop>();

  for (const stop of stops) {
    const key = normalizeTransportAddress(stop.address || "");
    if (!key) {
      order.push(`__raw:${order.length}:${stop.name}`);
      byKey.set(order[order.length - 1], stop);
      continue;
    }

    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, stop);
      order.push(key);
      continue;
    }
    byKey.set(key, mergeTwoStops(existing, stop));
  }

  return order.map((key) => byKey.get(key)!);
}
