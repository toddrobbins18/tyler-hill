import type { TransportRouteStop } from "@/lib/transportRoster";

export const CAMP_LOCATION = {
  name: "Camp — 85 Crescent Beach Rd",
  address: "85 Crescent Beach Road, Glen Cove, NY 11542",
  lat: 40.879993,
  lng: -73.642634,
  pickupTime: "",
  passengers: 0,
};

/** Reject null island and other coordinates that break routing / map lines. */
export function isValidRouteCoordinate(lat: number, lng: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return false;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return false;
  return true;
}

export const haversineMiles = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

/** Minutes the bus waits at each passenger pickup (not camp). */
export const DEFAULT_STOP_DWELL_MINUTES = 2;

/** Estimated driving minutes between two points (fractional — round only at display). */
export const estimateDrivingLegMinutes = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  if (!isValidRouteCoordinate(lat1, lng1) || !isValidRouteCoordinate(lat2, lng2)) return 0;
  const miles = haversineMiles(lat1, lng1, lat2, lng2) * 1.4;
  if (miles <= 0.001) return 0;
  return (miles / 25) * 60;
};

/** Haversine-based leg durations for an ordered stop list. */
export function computeHaversineLegMinutes(stops: TransportRouteStop[]): number[] {
  const legs: number[] = [];
  for (let i = 1; i < stops.length; i++) {
    const prev = stops[i - 1];
    const next = stops[i];
    legs.push(estimateDrivingLegMinutes(prev.lat, prev.lng, next.lat, next.lng));
  }
  return legs;
};

const isCampStopAddress = (address: string, campAddress: string) => address === campAddress;

/** Parse route departure (e.g. "7:00 AM") to minutes since midnight. */
export function parseDepartureToMinutes(departure: string | null | undefined): number | null {
  if (!departure) return null;
  const t = departure.trim();
  if (!t || t.toUpperCase() === "TBD") return null;

  const ampmMatch = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hour = parseInt(ampmMatch[1], 10);
    const min = parseInt(ampmMatch[2], 10);
    const ampm = ampmMatch[3].toUpperCase();
    if (ampm === "PM" && hour !== 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;
    return hour * 60 + min;
  }

  const h24Match = t.match(/^(\d{1,2}):(\d{2})$/);
  if (h24Match) {
    const hour = parseInt(h24Match[1], 10);
    const min = parseInt(h24Match[2], 10);
    if (hour >= 0 && hour < 24 && min >= 0 && min < 60) {
      return hour * 60 + min;
    }
  }

  return null;
}

/** Format minutes since midnight as a pickup clock time (e.g. "8:02 AM"). */
export function formatMinutesAsPickupTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const hour24 = Math.floor(normalized / 60);
  const min = normalized % 60;
  const ampm = hour24 >= 12 ? "PM" : "AM";
  const hour12 = hour24 % 12 || 12;
  return `${hour12}:${String(min).padStart(2, "0")} ${ampm}`;
}

export function assignStopTimesFromLegMinutes(
  stops: TransportRouteStop[],
  departureTime: string | null | undefined,
  legMinutes: number[],
  options?: {
    dwellMinutesPerStop?: number;
    campAddress?: string;
  },
): TransportRouteStop[] {
  if (stops.length === 0) return stops;

  const dwell = options?.dwellMinutesPerStop ?? DEFAULT_STOP_DWELL_MINUTES;
  const campAddress = options?.campAddress ?? CAMP_LOCATION.address;
  const startMinutes = parseDepartureToMinutes(departureTime);
  const useClock = startMinutes != null;
  let cumulativeMin = 0;

  return stops.map((stop, i) => {
    if (i > 0) {
      cumulativeMin += legMinutes[i - 1] ?? 0;
      const prev = stops[i - 1];
      if (!isCampStopAddress(prev.address, campAddress)) {
        cumulativeMin += dwell;
      }
    }

    const displayMinutes = useClock
      ? Math.ceil(startMinutes! + cumulativeMin)
      : Math.ceil(cumulativeMin);

    if (i === 0) {
      return {
        ...stop,
        pickupTime: useClock ? formatMinutesAsPickupTime(startMinutes!) : "Start",
      };
    }

    return {
      ...stop,
      pickupTime: useClock
        ? formatMinutesAsPickupTime(displayMinutes)
        : `+${displayMinutes} min`,
    };
  });
}

export type BuildRouteStopsOptions = {
  legMinutes?: number[] | null;
  dwellMinutesPerStop?: number;
};

/** AM routes: stops → camp (camp is last stop). */
export const buildAMStops = (
  stops: TransportRouteStop[],
  departureTime?: string | null,
  options?: BuildRouteStopsOptions | number[] | null,
): TransportRouteStop[] => {
  const opts = Array.isArray(options) ? { legMinutes: options } : options;
  const withCamp = [...stops, { ...CAMP_LOCATION, pickupTime: "", passengers: 0 }];
  const legs = opts?.legMinutes?.length === withCamp.length - 1
    ? opts.legMinutes
    : computeHaversineLegMinutes(withCamp);
  return assignStopTimesFromLegMinutes(withCamp, departureTime, legs, {
    dwellMinutesPerStop: opts?.dwellMinutesPerStop,
  });
};

/** PM routes: camp first, then same stop order as AM. */
export const buildPMStops = (
  stops: TransportRouteStop[],
  departureTime?: string | null,
  options?: BuildRouteStopsOptions | number[] | null,
): TransportRouteStop[] => {
  const opts = Array.isArray(options) ? { legMinutes: options } : options;
  const withCamp = [{ ...CAMP_LOCATION, pickupTime: "", passengers: 0 }, ...stops];
  const legs = opts?.legMinutes?.length === withCamp.length - 1
    ? opts.legMinutes
    : computeHaversineLegMinutes(withCamp);
  return assignStopTimesFromLegMinutes(withCamp, departureTime, legs, {
    dwellMinutesPerStop: opts?.dwellMinutesPerStop,
  });
};

export const displayStopToCoreIndex = (displayIdx: number, isAM: boolean): number =>
  isAM ? displayIdx : displayIdx - 1;

export const coreStopsFromAM = (stops: TransportRouteStop[]): TransportRouteStop[] =>
  stops.filter((s) => s.address !== CAMP_LOCATION.address);

export const coreStopsFromPM = (stops: TransportRouteStop[]): TransportRouteStop[] =>
  stops.filter((s) => s.address !== CAMP_LOCATION.address);

const isCampAddress = (address: string, campAddress: string = CAMP_LOCATION.address) =>
  address === campAddress;

/** First line of a mailing address (street) for compact route lists. */
export function shortStopStreet(address: string): string {
  const first = address.split(",")[0]?.trim();
  return first || address.trim() || "—";
}

export type RouteStopListLines = {
  title: string;
  subtitle: string | null;
  isOpenStop: boolean;
  camperNames: string[];
};

/** Two-line route stop label: camper name(s) + street address. */
export function routeStopListLines(
  stop: { name: string; address: string; passengers?: number; camperNames?: string[] },
  options: { isCamp: boolean; pendingNames?: string[] },
): RouteStopListLines {
  if (options.isCamp) {
    return { title: stop.name, subtitle: null, isOpenStop: false, camperNames: [] };
  }

  const street = shortStopStreet(stop.address);
  const names = (stop.camperNames ?? []).filter(Boolean);
  const assignedKeys = new Set(names.map((n) => n.trim().toLowerCase()));
  const pending = (options.pendingNames ?? [])
    .filter(Boolean)
    .filter((n) => !assignedKeys.has(n.trim().toLowerCase()));

  if (names.length > 0) {
    return {
      title: names.join(", "),
      subtitle:
        pending.length > 0
          ? `${street} · ${pending.length} more unassigned at this address`
          : street,
      isOpenStop: false,
      camperNames: names,
    };
  }

  if (pending.length > 0) {
    return {
      title: pending.join(", "),
      subtitle: `${street} · not on route yet`,
      isOpenStop: true,
      camperNames: pending,
    };
  }

  return {
    title: street,
    subtitle: "Open stop · no campers assigned",
    isOpenStop: true,
    camperNames: [],
  };
}

/** Stop label for route lists and map: 1, 2, 3… or C for camp. */
export function getRouteStopLabel(
  stops: Pick<TransportRouteStop, "address">[],
  index: number,
  campAddress: string = CAMP_LOCATION.address,
): string {
  if (isCampAddress(stops[index].address, campAddress)) return "C";
  let num = 0;
  for (let j = 0; j <= index; j++) {
    if (!isCampAddress(stops[j].address, campAddress)) num++;
  }
  return String(num);
}
