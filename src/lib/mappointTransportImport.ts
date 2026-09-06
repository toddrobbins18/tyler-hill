import { parseCSV } from "@/lib/csv";
import mappointRoutesCsv2026 from "../../data/north_shore_mappoint_routes_2026.csv?raw";

export function getBundledMappointRoutesCsv2026(): string {
  return mappointRoutesCsv2026;
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

const ADDRESS_LIKE = /\d/;

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
