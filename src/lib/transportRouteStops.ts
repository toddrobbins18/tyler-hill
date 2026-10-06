import { normalizeTransportAddress } from "@/lib/transportAddressNormalize";
import { isValidRouteCoordinate } from "@/lib/transportStopTimes";
import type { TransportRouteStop } from "@/lib/transportRoster";

const normRiderKey = (name: string) => name.trim().toLowerCase();

function refreshStopRiders(stop: TransportRouteStop, names: string[]): TransportRouteStop {
  if (names.length === 0) {
    return {
      ...stop,
      camperNames: [],
      passengers: 0,
      name: stop.address.split(",")[0]?.trim() || stop.address || stop.name,
    };
  }
  return {
    ...stop,
    camperNames: names,
    passengers: names.length,
    name:
      names.length === 1
        ? names[0]
        : `${names[0]} +${names.length - 1}`,
  };
}

/** Camper names on a stop — never treat a bare address label as a rider. */
export function riderNamesFromStop(stop: TransportRouteStop): string[] {
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

function mergeStopsByExactAddress(stops: TransportRouteStop[]): TransportRouteStop[] {
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

/** Merge only when normalized street address matches — safe after optimize reorder. */
export function consolidateExactAddressDuplicatesOnly(stops: TransportRouteStop[]): TransportRouteStop[] {
  return mergeStopsByExactAddress(stops);
}

/** Merge duplicate addresses on a route (template stop + camper stop at same address). */
export function consolidateRouteStopsByAddress(stops: TransportRouteStop[]): TransportRouteStop[] {
  const merged = mergeStopsByExactAddress(stops);

  // Merge empty template stops onto a staffed stop at the same street (not merely nearby coords).
  const remaining: TransportRouteStop[] = [];
  for (const stop of merged) {
    const hasRiders = riderNamesFromStop(stop).length > 0;
    if (hasRiders) {
      remaining.push(stop);
      continue;
    }

    const streetKey = normalizeTransportAddress(stop.address || "");
    let absorbed = false;
    for (let i = 0; i < remaining.length; i++) {
      const other = remaining[i];
      if (riderNamesFromStop(other).length === 0) continue;
      const sameStreet = streetKey && streetKey === normalizeTransportAddress(other.address || "");
      if (!sameStreet) continue;
      remaining[i] = mergeTwoStops(other, stop);
      absorbed = true;
      break;
    }
    if (!absorbed) remaining.push(stop);
  }

  return remaining;
}

/** True if a camper name already appears on any stop in this route. */
export function riderOnRoute(stops: TransportRouteStop[], camperName: string): boolean {
  const key = normRiderKey(camperName);
  return stops.some((s) => riderNamesFromStop(s).some((n) => normRiderKey(n) === key));
}

/** Remove one camper from every stop on a route (before re-assigning elsewhere). */
export function removeRiderFromRouteStops(
  stops: TransportRouteStop[],
  camperName: string,
): TransportRouteStop[] {
  const key = normRiderKey(camperName);
  return stops.map((stop) => {
    const names = riderNamesFromStop(stop).filter((n) => normRiderKey(n) !== key);
    if (names.length === riderNamesFromStop(stop).length) return stop;
    return refreshStopRiders(stop, names);
  });
}

/** Each camper name may appear on only one stop per route (first stop wins). */
export function dedupeRidersAcrossRoute(stops: TransportRouteStop[]): TransportRouteStop[] {
  const seen = new Set<string>();
  return stops.map((stop) => {
    const names = riderNamesFromStop(stop).filter((n) => {
      const k = normRiderKey(n);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
    if (names.length === riderNamesFromStop(stop).length) return stop;
    return refreshStopRiders(stop, names);
  });
}

/** Remove duplicate riders, then merge same-address stops. */
export function sanitizeRouteStops(stops: TransportRouteStop[]): TransportRouteStop[] {
  return consolidateRouteStopsByAddress(dedupeRidersAcrossRoute(stops));
}
