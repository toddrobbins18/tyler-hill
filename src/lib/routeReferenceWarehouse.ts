import type { SupabaseClient } from "@supabase/supabase-js";
import {
  lookupBundledMappointGeocode,
  parseMappointRoutesCsv,
  type MappointRouteRow,
  type ParsedMappointRoute,
} from "@/lib/mappointTransportImport";
import { parseCSV } from "@/lib/csv";

export type RouteReferenceSource = "mappoint";

export type RouteReferenceAssignment = {
  routeFile: string;
  busNumber: number;
  routeName: string;
  direction: "AM" | "PM";
  stopOrder: number;
  camperName: string;
  camperNameKey: string;
  street: string;
  city: string;
  zip: string;
  address: string;
  lat: number | null;
  lng: number | null;
  geocodeProvider: string | null;
  busCounselor: string;
};

export type RouteReferenceImportStats = {
  assignmentCount: number;
  routeCount: number;
  busCount: number;
  amAssignmentCount: number;
  pmAssignmentCount: number;
  geocodedCount: number;
  missingAddressCount: number;
  referenceSeason: string;
};

export type RouteReferenceImportPayload = {
  referenceSeason: string;
  source: RouteReferenceSource;
  label: string;
  assignments: RouteReferenceAssignment[];
  stats: RouteReferenceImportStats;
};

export type RouteReferenceImportRecord = {
  id: string;
  companyId: string;
  referenceSeason: string;
  source: string;
  label: string | null;
  importedAt: string;
  stats: RouteReferenceImportStats;
};

export type CamperRoutingPrior = {
  camperName: string;
  camperNameKey: string;
  referenceSeason: string;
  busNumber: number;
  routeName: string;
  direction: "AM" | "PM";
  stopOrder: number;
  address: string;
  lat: number | null;
  lng: number | null;
  routeFile: string;
};

export type ReferenceRouteSummary = {
  busNumber: number;
  routeName: string;
  routeFile: string;
  direction: "AM" | "PM";
  busCounselor: string;
  stopCount: number;
  camperCount: number;
};

export type ReferenceRouteStop = {
  stopOrder: number;
  address: string;
  lat: number | null;
  lng: number | null;
  camperNames: string[];
};

const ADDRESS_LIKE = /\d/;

export function normCamperNameKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

function rowAddress(row: MappointRouteRow): string {
  const trimmed = (row.address || "").trim();
  if (trimmed) return trimmed;
  const street = (row.street || "").trim();
  const city = (row.city || "").trim();
  const zip = (row.zip || "").trim();
  if (!street || !city) return "";
  return zip ? `${street}, ${city}, NY ${zip}` : `${street}, ${city}, NY`;
}

function isValidAssignmentRow(row: MappointRouteRow): boolean {
  const name = (row.camper_name || "").trim();
  const address = rowAddress(row);
  if (!name || !address) return false;
  if (!ADDRESS_LIKE.test(address)) return false;
  if (name.length < 3) return false;
  return true;
}

function normalizeDirection(raw: string): "AM" | "PM" | null {
  const upper = (raw || "AM").trim().toUpperCase();
  if (upper === "AM" || upper === "PM") return upper;
  return null;
}

export function buildRouteReferenceFromMappointCsv(
  csvText: string,
  options: {
    referenceSeason: string;
    label?: string;
    geocodeLookup?: (address: string) => { lat: number; lng: number; provider?: string } | null;
  },
): RouteReferenceImportPayload {
  const rows = parseCSV(csvText) as MappointRouteRow[];
  const geocodeLookup = options.geocodeLookup ?? lookupBundledMappointGeocode;
  const assignments: RouteReferenceAssignment[] = [];

  for (const row of rows) {
    if (!isValidAssignmentRow(row)) continue;

    const direction = normalizeDirection(row.direction);
    if (!direction) continue;

    const busNumber = parseInt(String(row.bus_number || ""), 10);
    if (!Number.isFinite(busNumber) || busNumber <= 0) continue;

    const address = rowAddress(row);
    const geo = geocodeLookup(address);
    const camperName = row.camper_name.trim();

    assignments.push({
      routeFile: (row.route_file || "").trim(),
      busNumber,
      routeName: (row.route_name || `Bus ${busNumber}`).trim(),
      direction,
      stopOrder: parseInt(String(row.stop_order || ""), 10) || 0,
      camperName,
      camperNameKey: normCamperNameKey(camperName),
      street: (row.street || "").trim(),
      city: (row.city || "").trim(),
      zip: (row.zip || "").trim(),
      address,
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      geocodeProvider: geo?.provider ?? null,
      busCounselor: (row.bus_counselor || "").trim(),
    });
  }

  assignments.sort(
    (a, b) =>
      a.busNumber - b.busNumber ||
      a.direction.localeCompare(b.direction) ||
      a.stopOrder - b.stopOrder ||
      a.camperName.localeCompare(b.camperName),
  );

  const routeKeys = new Set(
    assignments.map((a) => `${a.routeFile}|${a.busNumber}|${a.direction}`),
  );
  const busKeys = new Set(assignments.map((a) => `${a.busNumber}|${a.direction}`));

  const stats: RouteReferenceImportStats = {
    referenceSeason: options.referenceSeason,
    assignmentCount: assignments.length,
    routeCount: routeKeys.size,
    busCount: busKeys.size,
    amAssignmentCount: assignments.filter((a) => a.direction === "AM").length,
    pmAssignmentCount: assignments.filter((a) => a.direction === "PM").length,
    geocodedCount: assignments.filter((a) => a.lat != null && a.lng != null).length,
    missingAddressCount: rows.length - assignments.length,
  };

  return {
    referenceSeason: options.referenceSeason,
    source: "mappoint",
    label: options.label ?? `MapPoint ${options.referenceSeason}`,
    assignments,
    stats,
  };
}

export function summarizeReferenceRoutes(
  assignments: RouteReferenceAssignment[],
): ReferenceRouteSummary[] {
  const map = new Map<string, ReferenceRouteSummary & { stops: Set<string>; campers: number }>();

  for (const row of assignments) {
    const key = `${row.busNumber}|${row.direction}|${row.routeFile}`;
    let entry = map.get(key);
    if (!entry) {
      entry = {
        busNumber: row.busNumber,
        routeName: row.routeName,
        routeFile: row.routeFile,
        direction: row.direction,
        busCounselor: row.busCounselor,
        stopCount: 0,
        camperCount: 0,
        stops: new Set<string>(),
        campers: 0,
      };
      map.set(key, entry);
    }
    if (!entry.busCounselor && row.busCounselor) entry.busCounselor = row.busCounselor;
    entry.stops.add(`${row.stopOrder}|${row.address.toLowerCase()}`);
    entry.campers += 1;
  }

  return Array.from(map.values())
    .map(({ stops, campers, ...rest }) => ({
      ...rest,
      stopCount: stops.size,
      camperCount: campers,
    }))
    .sort(
      (a, b) =>
        a.busNumber - b.busNumber || a.direction.localeCompare(b.direction),
    );
}

export function buildReferenceRouteStops(
  assignments: RouteReferenceAssignment[],
  busNumber: number,
  direction: "AM" | "PM",
): ReferenceRouteStop[] {
  const rows = assignments.filter(
    (a) => a.busNumber === busNumber && a.direction === direction,
  );
  const byAddress = new Map<string, ReferenceRouteStop>();

  for (const row of rows) {
    const key = row.address.trim().toLowerCase();
    let stop = byAddress.get(key);
    if (!stop) {
      stop = {
        stopOrder: row.stopOrder,
        address: row.address,
        lat: row.lat,
        lng: row.lng,
        camperNames: [],
      };
      byAddress.set(key, stop);
    }
    stop.stopOrder = Math.min(stop.stopOrder, row.stopOrder);
    if (row.lat != null && row.lng != null) {
      stop.lat = row.lat;
      stop.lng = row.lng;
    }
    stop.camperNames.push(row.camperName);
  }

  return Array.from(byAddress.values()).sort((a, b) => a.stopOrder - b.stopOrder);
}

export function buildCamperPriorMap(
  priors: CamperRoutingPrior[],
): Map<string, CamperRoutingPrior> {
  const map = new Map<string, CamperRoutingPrior>();
  for (const prior of priors) {
    const key = `${prior.camperNameKey}|${prior.direction}`;
    if (!map.has(key)) map.set(key, prior);
  }
  return map;
}

export function buildAddressHintsFromPriors(
  priors: CamperRoutingPrior[],
): Map<string, { address: string; lat: number; lng: number; busNumber: number }> {
  const map = new Map<string, { address: string; lat: number; lng: number; busNumber: number }>();
  for (const prior of priors) {
    if (prior.direction !== "AM") continue;
    if (!prior.address || prior.lat == null || prior.lng == null) continue;
    if (map.has(prior.camperNameKey)) continue;
    map.set(prior.camperNameKey, {
      address: prior.address,
      lat: prior.lat,
      lng: prior.lng,
      busNumber: prior.busNumber,
    });
  }
  return map;
}

function mapAssignmentRow(row: Record<string, unknown>): RouteReferenceAssignment {
  return {
    routeFile: String(row.route_file ?? ""),
    busNumber: Number(row.bus_number),
    routeName: String(row.route_name ?? ""),
    direction: String(row.direction) as "AM" | "PM",
    stopOrder: Number(row.stop_order),
    camperName: String(row.camper_name ?? ""),
    camperNameKey: String(row.camper_name_key ?? ""),
    street: String(row.street ?? ""),
    city: String(row.city ?? ""),
    zip: String(row.zip ?? ""),
    address: String(row.address ?? ""),
    lat: row.lat == null ? null : Number(row.lat),
    lng: row.lng == null ? null : Number(row.lng),
    geocodeProvider: row.geocode_provider ? String(row.geocode_provider) : null,
    busCounselor: String(row.bus_counselor ?? ""),
  };
}

export async function importRouteReference(
  supabase: SupabaseClient,
  companyId: string,
  payload: RouteReferenceImportPayload,
  options?: { userId?: string | null; replace?: boolean },
): Promise<{ importId: string | null; error?: string }> {
  const replace = options?.replace !== false;

  if (replace) {
    const { error: deleteAssignmentsError } = await supabase
      .from("route_reference_assignments" as "profiles")
      .delete()
      .eq("company_id", companyId)
      .eq("reference_season", payload.referenceSeason);

    if (deleteAssignmentsError) {
      return { importId: null, error: deleteAssignmentsError.message };
    }

    const { error: deleteImportError } = await supabase
      .from("route_reference_imports" as "profiles")
      .delete()
      .eq("company_id", companyId)
      .eq("reference_season", payload.referenceSeason)
      .eq("source", payload.source);

    if (deleteImportError) {
      return { importId: null, error: deleteImportError.message };
    }
  }

  const { data: importRow, error: importError } = await supabase
    .from("route_reference_imports" as "profiles")
    .insert({
      company_id: companyId,
      reference_season: payload.referenceSeason,
      source: payload.source,
      label: payload.label,
      imported_by: options?.userId ?? null,
      stats: payload.stats as never,
    } as never)
    .select("id")
    .single();

  if (importError || !importRow) {
    return { importId: null, error: importError?.message ?? "Import insert failed" };
  }

  const importId = (importRow as { id: string }).id;
  const chunkSize = 200;

  for (let i = 0; i < payload.assignments.length; i += chunkSize) {
    const chunk = payload.assignments.slice(i, i + chunkSize).map((a) => ({
      import_id: importId,
      company_id: companyId,
      reference_season: payload.referenceSeason,
      route_file: a.routeFile,
      bus_number: a.busNumber,
      route_name: a.routeName,
      direction: a.direction,
      stop_order: a.stopOrder,
      camper_name: a.camperName,
      camper_name_key: a.camperNameKey,
      street: a.street,
      city: a.city,
      zip: a.zip,
      address: a.address,
      lat: a.lat,
      lng: a.lng,
      geocode_provider: a.geocodeProvider,
      bus_counselor: a.busCounselor,
    }));

    const { error } = await supabase
      .from("route_reference_assignments" as "profiles")
      .insert(chunk as never);

    if (error) {
      return { importId: null, error: error.message };
    }
  }

  return { importId };
}

export async function loadRouteReferenceImport(
  supabase: SupabaseClient,
  companyId: string,
  referenceSeason: string,
  source: RouteReferenceSource = "mappoint",
): Promise<RouteReferenceImportRecord | null> {
  const { data, error } = await supabase
    .from("route_reference_imports" as "profiles")
    .select("id, company_id, reference_season, source, label, imported_at, stats")
    .eq("company_id", companyId)
    .eq("reference_season", referenceSeason)
    .eq("source", source)
    .maybeSingle();

  if (error || !data) return null;

  const row = data as Record<string, unknown>;
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    referenceSeason: String(row.reference_season),
    source: String(row.source),
    label: row.label ? String(row.label) : null,
    importedAt: String(row.imported_at),
    stats: (row.stats ?? {}) as RouteReferenceImportStats,
  };
}

export async function loadRouteReferenceAssignments(
  supabase: SupabaseClient,
  companyId: string,
  referenceSeason: string,
  filters?: { direction?: "AM" | "PM"; busNumber?: number },
): Promise<RouteReferenceAssignment[]> {
  let query = supabase
    .from("route_reference_assignments" as "profiles")
    .select("*")
    .eq("company_id", companyId)
    .eq("reference_season", referenceSeason)
    .order("bus_number")
    .order("direction")
    .order("stop_order");

  if (filters?.direction) query = query.eq("direction", filters.direction);
  if (filters?.busNumber != null) query = query.eq("bus_number", filters.busNumber);

  const { data, error } = await query;
  if (error) {
    console.error("[RouteReference] load assignments failed:", error.message);
    return [];
  }

  return (data ?? []).map((row) => mapAssignmentRow(row as Record<string, unknown>));
}

export async function loadCamperRoutingPriors(
  supabase: SupabaseClient,
  companyId: string,
  options?: {
    referenceSeason?: string;
    direction?: "AM" | "PM";
  },
): Promise<CamperRoutingPrior[]> {
  let query = supabase
    .from("route_reference_assignments" as "profiles")
    .select("*")
    .eq("company_id", companyId)
    .order("reference_season", { ascending: false })
    .order("camper_name_key")
    .order("direction");

  if (options?.referenceSeason) {
    query = query.eq("reference_season", options.referenceSeason);
  }
  if (options?.direction) {
    query = query.eq("direction", options.direction);
  }

  const { data, error } = await query;
  if (error) {
    console.error("[RouteReference] load priors failed:", error.message);
    return [];
  }

  const seen = new Set<string>();
  const priors: CamperRoutingPrior[] = [];

  for (const raw of data ?? []) {
    const row = mapAssignmentRow(raw as Record<string, unknown>);
    const key = `${row.camperNameKey}|${row.direction}|${options?.referenceSeason ?? "latest"}`;
    if (seen.has(key)) continue;
    seen.add(key);

    priors.push({
      camperName: row.camperName,
      camperNameKey: row.camperNameKey,
      referenceSeason: String((raw as { reference_season?: string }).reference_season ?? ""),
      busNumber: row.busNumber,
      routeName: row.routeName,
      direction: row.direction,
      stopOrder: row.stopOrder,
      address: row.address,
      lat: row.lat,
      lng: row.lng,
      routeFile: row.routeFile,
    });
  }

  return priors.sort((a, b) => a.camperName.localeCompare(b.camperName));
}

/** Parsed MapPoint routes from warehouse assignments (merged stops). */
export function parsedRoutesFromAssignments(
  assignments: RouteReferenceAssignment[],
  direction: "AM" | "PM" = "AM",
): ParsedMappointRoute[] {
  const summaries = summarizeReferenceRoutes(assignments.filter((a) => a.direction === direction));
  return summaries.map((summary) => ({
    busNumber: summary.busNumber,
    routeName: summary.routeName,
    routeFile: summary.routeFile,
    busCounselor: summary.busCounselor,
    direction: summary.direction,
    stops: buildReferenceRouteStops(assignments, summary.busNumber, summary.direction).map(
      (stop) => ({
        stopOrder: stop.stopOrder,
        address: stop.address,
        camperNames: stop.camperNames,
        label: stop.address.split(",")[0]?.trim() || stop.address,
      }),
    ),
  }));
}

/** Compare warehouse output to direct CSV parse — useful for validation. */
export function validateWarehouseAgainstCsv(csvText: string, payload: RouteReferenceImportPayload) {
  const parsed = parseMappointRoutesCsv(csvText, { direction: "ALL" });
  return {
    csvRouteCount: parsed.length,
    warehouseRouteCount: summarizeReferenceRoutes(payload.assignments).length,
    csvAssignmentCount: payload.stats.assignmentCount,
    geocodedPct:
      payload.stats.assignmentCount > 0
        ? Math.round((payload.stats.geocodedCount / payload.stats.assignmentCount) * 100)
        : 0,
  };
}
