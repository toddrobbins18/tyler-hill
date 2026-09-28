import type { TransportRouteStop } from "@/lib/transportRoster";

export const CAMP_LOCATION = {
  name: "Camp — 85 Crescent Beach Rd",
  address: "85 Crescent Beach Road, Glen Cove, NY 11542",
  lat: 40.879993,
  lng: -73.642634,
  pickupTime: "",
  passengers: 0,
};

export const haversineMiles = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 3958.8;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const drivingMinutes = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const miles = haversineMiles(lat1, lng1, lat2, lng2) * 1.4;
  return Math.round((miles / 25) * 60);
};

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

const assignDrivingTimes = (
  stops: TransportRouteStop[],
  departureTime?: string | null,
): TransportRouteStop[] => {
  if (stops.length === 0) return stops;
  const startMinutes = parseDepartureToMinutes(departureTime);
  const useClock = startMinutes != null;
  let cumulativeMin = 0;

  return stops.map((stop, i) => {
    if (i === 0) {
      return {
        ...stop,
        pickupTime: useClock ? formatMinutesAsPickupTime(startMinutes) : "Start",
      };
    }
    const prev = stops[i - 1];
    const legMin = Math.max(drivingMinutes(prev.lat, prev.lng, stop.lat, stop.lng), 2);
    cumulativeMin += legMin;
    return {
      ...stop,
      pickupTime: useClock
        ? formatMinutesAsPickupTime(startMinutes + cumulativeMin)
        : `+${cumulativeMin} min`,
    };
  });
};

/** AM routes: stops → camp (camp is last stop). */
export const buildAMStops = (
  stops: TransportRouteStop[],
  departureTime?: string | null,
): TransportRouteStop[] =>
  assignDrivingTimes([...stops, { ...CAMP_LOCATION, pickupTime: "", passengers: 0 }], departureTime);

/** PM routes: camp first, then same stop order as AM. */
export const buildPMStops = (
  stops: TransportRouteStop[],
  departureTime?: string | null,
): TransportRouteStop[] =>
  assignDrivingTimes([{ ...CAMP_LOCATION, pickupTime: "", passengers: 0 }, ...stops], departureTime);

export const displayStopToCoreIndex = (displayIdx: number, isAM: boolean): number =>
  isAM ? displayIdx : displayIdx - 1;

export const coreStopsFromAM = (stops: TransportRouteStop[]): TransportRouteStop[] =>
  stops.filter((s) => s.address !== CAMP_LOCATION.address);

export const coreStopsFromPM = (stops: TransportRouteStop[]): TransportRouteStop[] =>
  stops.filter((s) => s.address !== CAMP_LOCATION.address);

const isCampAddress = (address: string, campAddress: string = CAMP_LOCATION.address) =>
  address === campAddress;

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
