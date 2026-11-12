import { parseCSV } from "@/lib/csv";
import mappointRoutesCsv2026 from "../../data/north_shore_mappoint_routes_2026.csv?raw";
import mappointAddressesCsv2026 from "../../data/north_shore_mappoint_addresses_2026.csv?raw";
import bundledGeocodes2026 from "../../data/north_shore_mappoint_geocodes_2026.json";

export function getBundledMappointRoutesCsv2026(): string {
  return mappointRoutesCsv2026;
}

export function getBundledMappointAddressesCsv2026(): string {
  return mappointAddressesCsv2026;
}

export type MappointAddressRow = {
  name: string;
  street: string;
  city: string;
  zip: string;
  address: string;
};

const ADDRESS_LIKE = /\d/;

function buildAddressFromParts(street: string, city: string, zip: string): string {
  const s = street.trim();
  const c = city.trim();
  const z = zip.trim();
  if (!s || !c) return "";
  return z ? `${s}, ${c}, NY ${z}` : `${s}, ${c}, NY`;
}

/** Skip rows where the name column is actually a street address. */
function isValidCamperAddressRow(name: string, address: string): boolean {
  if (!name || name.length < 3) return false;
  if (!ADDRESS_LIKE.test(address)) return false;
  if (/^\d/.test(name) && /\b(rd|road|ave|avenue|ln|lane|st|street|dr|drive|ct|court|way|blvd|ny)\b/i.test(name)) {
    return false;
  }
  return true;
}

/** Parse MapPoint addresses CSV (camper name + home address — more complete than routes alone). */
export function parseMappointAddressesCsv(csvText: string): MappointAddressRow[] {
  const rows = parseCSV(csvText) as Record<string, string>[];
  const out: MappointAddressRow[] = [];

  for (const row of rows) {
    const name = (row.name || "").trim();
    const street = (row.street || "").trim();
    const city = (row.city || "").trim();
    const zip = (row.zip || "").trim();
    const address = (row.address || "").trim() || buildAddressFromParts(street, city, zip);
    if (!isValidCamperAddressRow(name, address)) continue;
    out.push({ name, street, city, zip, address });
  }

  return out;
}

export type BundledGeocode = { lat: number; lng: number; provider?: string };

export type GeocodeCacheEntry = { lat: number; lng: number; provider?: string };

const bundledGeocodeMap = bundledGeocodes2026 as Record<string, BundledGeocode>;

const STREET_SUFFIX: Record<string, string> = {
  drive: "dr",
  avenue: "ave",
  street: "st",
  road: "rd",
  lane: "ln",
  court: "ct",
  place: "pl",
  boulevard: "blvd",
  terrace: "ter",
  circle: "cir",
  highway: "hwy",
  parkway: "pkwy",
  trail: "trl",
};

const STREET_DIRECTION: Record<string, string> = {
  north: "n",
  south: "s",
  east: "e",
  west: "w",
};

const normGeocodeKey = (address: string) =>
  address.trim().toLowerCase().replace(/\s+/g, " ");

function stripGeocodeUnit(address: string): string {
  return address
    .replace(/\s*(?:#|apt\.?|apartment|unit|ste\.?|suite)\s*[a-z0-9-]+/gi, "")
    .replace(/\b(?:fl|floor)\s+[a-z0-9-]+\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .replace(/,\s*,/g, ",")
    .trim();
}

/** Drive → Dr so CampMinder "Soundview Drive" hits MapPoint "Soundview Dr". */
export function canonicalizeGeocodeKey(address: string): string {
  let raw = normGeocodeKey(stripGeocodeUnit(address)).replace(/\./g, "");
  raw = raw.replace(
    /\b(drive|avenue|street|road|lane|court|place|boulevard|terrace|circle|highway|parkway|trail)\b/g,
    (word) => STREET_SUFFIX[word] ?? word,
  );
  const parts = raw.split(",").map((part) => part.trim());
  if (parts[0]) {
    parts[0] = parts[0].replace(
      /\b(north|south|east|west)\b/g,
      (word) => STREET_DIRECTION[word] ?? word,
    );
  }
  return parts.filter(Boolean).join(", ");
}

type ParsedStreet = { house: number; street: string; city: string; zip: string };

function parseCanonicalStreet(address: string): ParsedStreet | null {
  const canonical = canonicalizeGeocodeKey(address);
  const parts = canonical.split(",").map((part) => part.trim());
  const streetPart = parts[0] ?? "";
  const match = streetPart.match(
    /^(\d+)(?:-\d+)?(?:[a-z](?=\s)|(?!\s+[nsew]\b)\s+[a-z]\b)?\s+(.+)$/i,
  );
  if (!match) return null;
  return {
    house: Number(match[1]),
    street: match[2].toLowerCase(),
    city: (parts[1] ?? "").toLowerCase(),
    zip: canonical.match(/\b(\d{5})\b/)?.[1] ?? "",
  };
}

function streetsCompatible(a: string, b: string): boolean {
  if (a === b) return true;
  const prefix = /^(n|s|e|w) /;
  if (prefix.test(a) === prefix.test(b)) return false;
  return a.replace(prefix, "") === b.replace(prefix, "");
}

function citiesCompatible(a: string, b: string): boolean {
  if (!a || !b) return true;
  if (a === b) return true;
  const strip = (value: string) =>
    value.replace(/\b(heights|hts|manor|hills|harbor)\b/g, "").replace(/\s+/g, " ").trim();
  const left = strip(a);
  const right = strip(b);
  if (left && right && left === right) return true;
  return a.startsWith(b) || b.startsWith(a);
}

function lerpHouse(
  a: { house: number; lat: number; lng: number },
  b: { house: number; lat: number; lng: number },
  house: number,
): BundledGeocode {
  const span = b.house - a.house;
  if (!span) return { lat: a.lat, lng: a.lng, provider: "ors" };
  const t = (house - a.house) / span;
  return {
    lat: a.lat + t * (b.lat - a.lat),
    lng: a.lng + t * (b.lng - a.lng),
    provider: "ors",
  };
}

function approxMiles(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = (b.lat - a.lat) * 69;
  const dLng = (b.lng - a.lng) * 69 * Math.cos((a.lat * Math.PI) / 180);
  return Math.hypot(dLat, dLng);
}

function corridorPointsFor(parsed: ParsedStreet): { house: number; lat: number; lng: number }[] {
  const sameStreet: { house: number; lat: number; lng: number; city: string; zip: string }[] = [];
  for (const [key, hit] of Object.entries(bundledGeocodeMap)) {
    if (hit?.lat == null || hit?.lng == null) continue;
    const row = parseCanonicalStreet(key);
    if (!row || !streetsCompatible(row.street, parsed.street)) continue;
    sameStreet.push({
      house: row.house,
      lat: hit.lat,
      lng: hit.lng,
      city: row.city,
      zip: row.zip,
    });
  }
  if (!sameStreet.length) return [];
  if (parsed.zip) {
    return sameStreet.filter((row) => !row.zip || row.zip === parsed.zip);
  }
  if (parsed.city) {
    return sameStreet.filter((row) => citiesCompatible(parsed.city, row.city));
  }
  const zips = new Set(sameStreet.map((row) => row.zip).filter(Boolean));
  return zips.size <= 1 ? sameStreet : [];
}

function interpolateBundledStreetGeocode(address: string): BundledGeocode | null {
  const parsed = parseCanonicalStreet(address);
  if (!parsed) return null;
  const points = corridorPointsFor(parsed);
  if (!points.length) return null;
  const exact = points.find((row) => row.house === parsed.house);
  if (exact) return { lat: exact.lat, lng: exact.lng, provider: "ors" };

  points.sort((a, b) => a.house - b.house);
  let lower: (typeof points)[number] | undefined;
  let upper: (typeof points)[number] | undefined;
  for (const row of points) {
    if (row.house < parsed.house) lower = row;
    if (row.house > parsed.house) {
      upper = row;
      break;
    }
  }
  if (lower && upper) return lerpHouse(lower, upper, parsed.house);

  const nearest = points.reduce((best, row) =>
    Math.abs(row.house - parsed.house) < Math.abs(best.house - parsed.house) ? row : best,
  );
  if (points.length >= 2) {
    const a = parsed.house <= points[0].house ? points[0] : points[points.length - 2];
    const b = parsed.house <= points[0].house ? points[1] : points[points.length - 1];
    const geo = lerpHouse(a, b, parsed.house);
    if (approxMiles(geo, nearest) > 0.6) {
      return { lat: nearest.lat, lng: nearest.lng, provider: "ors" };
    }
    return geo;
  }
  return { lat: nearest.lat, lng: nearest.lng, provider: "ors" };
}

/** Pre-geocoded MapPoint addresses — instant import, no API calls in production. */
export function lookupBundledMappointGeocode(address: string): BundledGeocode | null {
  const canonical = canonicalizeGeocodeKey(address);
  const direct = bundledGeocodeMap[canonical] ?? bundledGeocodeMap[normGeocodeKey(address)];
  if (direct?.lat != null && direct?.lng != null) return direct;
  for (const [key, hit] of Object.entries(bundledGeocodeMap)) {
    if (canonicalizeGeocodeKey(key) !== canonical) continue;
    if (hit?.lat != null && hit?.lng != null) return hit;
  }
  return null;
}

/** Match "121 Salem Rd" to bundled "121 salem rd, roslyn heights, ny 11577". */
export function lookupBundledMappointGeocodeFuzzy(address: string): BundledGeocode | null {
  const exact = lookupBundledMappointGeocode(address);
  if (exact) return exact;

  const streetOnly = canonicalizeGeocodeKey(address).split(",")[0]?.trim() ?? "";
  if (streetOnly.length < 5) return null;

  for (const [key, hit] of Object.entries(bundledGeocodeMap)) {
    const canonicalKey = canonicalizeGeocodeKey(key);
    if (canonicalKey === streetOnly || canonicalKey.startsWith(`${streetOnly},`)) {
      if (hit?.lat != null && hit?.lng != null) return hit;
    }
  }
  return interpolateBundledStreetGeocode(address);
}

/** Resolve from bundled MapPoint cache (377 North Shore AM stops). */
export function resolveBundledGeocodeResult(address: string): {
  lat: number;
  lng: number;
  provider: "ors" | "nominatim" | "census";
} | null {
  const hit = lookupBundledMappointGeocodeFuzzy(address);
  if (!hit) return null;
  const provider = hit.provider === "nominatim" || hit.provider === "census" ? hit.provider : "ors";
  return { lat: hit.lat, lng: hit.lng, provider };
}

/** MapPoint street wins over a saved/live geocode that drifted (bay, wrong block). */
export function snapToBundledGeocode(
  address: string,
  lat: number,
  lng: number,
): { lat: number; lng: number } {
  const bundled = resolveBundledGeocodeResult(address);
  if (!bundled) return { lat, lng };
  return { lat: bundled.lat, lng: bundled.lng };
}

export function bundledMappointGeocodeCount() {
  return Object.keys(bundledGeocodeMap).length;
}

export function seedGeocodeCacheFromBundled(
  cache: Map<string, GeocodeCacheEntry | null>,
) {
  for (const [key, hit] of Object.entries(bundledGeocodeMap)) {
    cache.set(key, {
      lat: hit.lat,
      lng: hit.lng,
      provider: hit.provider || "ors",
    });
  }
}

export type MappointRouteRow = {
  route_file: string;
  bus_number: string;
  route_name: string;
  direction: string;
  stop_order: string;
  camper_name: string;
  street: string;
  city: string;
  zip: string;
  address: string;
  bus_counselor: string;
};

export type ParsedMappointStop = {
  stopOrder: number;
  address: string;
  camperNames: string[];
  label: string;
};

export type ParsedMappointRoute = {
  busNumber: number;
  routeName: string;
  routeFile: string;
  busCounselor: string;
  direction: string;
  stops: ParsedMappointStop[];
};

function rowAddress(row: MappointRouteRow): string {
  const trimmed = (row.address || "").trim();
  if (trimmed) return trimmed;
  const street = (row.street || "").trim();
  const city = (row.city || "").trim();
  const zip = (row.zip || "").trim();
  if (!street || !city) return "";
  return zip ? `${street}, ${city}, NY ${zip}` : `${street}, ${city}, NY`;
}

function isValidCamperRow(row: MappointRouteRow): boolean {
  const name = (row.camper_name || "").trim();
  const address = rowAddress(row);
  if (!name || !address) return false;
  if (!ADDRESS_LIKE.test(address)) return false;
  if (name.length < 3) return false;
  return true;
}

/** Parse MapPoint routes CSV into per-bus stop lists (AM routes by default). */
export function parseMappointRoutesCsv(
  csvText: string,
  options: { direction?: "AM" | "PM" | "ALL" } = {},
): ParsedMappointRoute[] {
  const direction = options.direction ?? "AM";
  const rows = parseCSV(csvText) as MappointRouteRow[];

  const byBus = new Map<number, ParsedMappointRoute>();

  for (const row of rows) {
    const rowDirection = (row.direction || "AM").toUpperCase();
    if (direction !== "ALL" && rowDirection !== direction) continue;
    if (!isValidCamperRow(row)) continue;

    const busNumber = parseInt(String(row.bus_number || ""), 10);
    if (!Number.isFinite(busNumber) || busNumber <= 0) continue;

    let route = byBus.get(busNumber);
    if (!route) {
      route = {
        busNumber,
        routeName: (row.route_name || `Bus ${busNumber}`).trim(),
        routeFile: (row.route_file || "").trim(),
        busCounselor: (row.bus_counselor || "").trim(),
        direction: rowDirection,
        stops: [],
      };
      byBus.set(busNumber, route);
    }

    if (!route.busCounselor && row.bus_counselor) {
      route.busCounselor = row.bus_counselor.trim();
    }

    const stopOrder = parseInt(String(row.stop_order || ""), 10) || route.stops.length + 1;
    const address = rowAddress(row);
    const camperName = row.camper_name.trim();

    route.stops.push({
      stopOrder,
      address,
      camperNames: [camperName],
      label: address.split(",")[0]?.trim() || address,
    });
  }

  // Sort stops and merge same address within a route
  const routes: ParsedMappointRoute[] = [];
  for (const route of byBus.values()) {
    route.stops.sort((a, b) => a.stopOrder - b.stopOrder);

    const merged: ParsedMappointStop[] = [];
    const indexByAddress = new Map<string, number>();

    for (const stop of route.stops) {
      const key = stop.address.toLowerCase();
      const existingIdx = indexByAddress.get(key);
      if (existingIdx != null) {
        merged[existingIdx].camperNames.push(...stop.camperNames);
      } else {
        indexByAddress.set(key, merged.length);
        merged.push({ ...stop, camperNames: [...stop.camperNames] });
      }
    }

    route.stops = merged;
    if (route.stops.length > 0) routes.push(route);
  }

  return routes.sort((a, b) => a.busNumber - b.busNumber);
}

export function mappointRoutesSummary(routes: ParsedMappointRoute[]) {
  const stopCount = routes.reduce((n, r) => n + r.stops.length, 0);
  const camperCount = routes.reduce(
    (n, r) => n + r.stops.reduce((s, st) => s + st.camperNames.length, 0),
    0,
  );
  return { routeCount: routes.length, stopCount, camperCount };
}
