import type { SupabaseClient } from "@supabase/supabase-js";

export type BusAttendanceStatus = "present" | "absent";

export type BusAttendanceMap = Record<string, BusAttendanceStatus>;

export type BusSubmissionRecord = {
  submittedAt: string;
  submittedBy?: string | null;
};

export type BusSubmissionsMap = Record<string, BusSubmissionRecord>;

export function attendanceRecordKey(routeId: number, camperName: string): string {
  return `${routeId}|${camperName.trim().toLowerCase()}`;
}

export function busSubmissionKey(routeId: number): string {
  return String(routeId);
}

export function parseAttendanceMap(raw: unknown): BusAttendanceMap {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const map: BusAttendanceMap = {};
  if (obj.records && typeof obj.records === "object" && !Array.isArray(obj.records)) {
    for (const [key, val] of Object.entries(obj.records as Record<string, unknown>)) {
      if (val === "present" || val === "absent") map[key] = val;
    }
    return map;
  }
  for (const [key, val] of Object.entries(obj)) {
    if (key === "submittedAt" || key === "busSubmissions") continue;
    if (val === "present" || val === "absent") map[key] = val;
  }
  return map;
}

export function parseBusSubmissions(raw: unknown): BusSubmissionsMap {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const source = obj.busSubmissions;
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};
  const map: BusSubmissionsMap = {};
  for (const [key, val] of Object.entries(source as Record<string, unknown>)) {
    if (!val || typeof val !== "object" || Array.isArray(val)) continue;
    const row = val as Record<string, unknown>;
    if (typeof row.submittedAt === "string") {
      map[key] = {
        submittedAt: row.submittedAt,
        submittedBy: typeof row.submittedBy === "string" ? row.submittedBy : null,
      };
    }
  }
  return map;
}

export type BusAttendancePayload = {
  records: BusAttendanceMap;
  submittedAt?: string | null;
  busSubmissions?: BusSubmissionsMap;
};

export function attendanceStatusLabel(
  key: string,
  map: BusAttendanceMap,
): "Present" | "Absent" | "Unmarked" {
  const s = map[key];
  if (s === "present") return "Present";
  if (s === "absent") return "Absent";
  return "Unmarked";
}

export function isRouteBusSubmitted(routeId: number, busSubmissions: BusSubmissionsMap): boolean {
  return !!busSubmissions[busSubmissionKey(routeId)]?.submittedAt;
}

export function routeIdsWithCampers(
  routeMeta: { id: number }[],
  coreStops: Record<number, { passengers: number }[]>,
): number[] {
  return routeMeta
    .filter((meta) => (coreStops[meta.id] ?? []).some((s) => s.passengers > 0))
    .map((meta) => meta.id);
}

export function allRoutesBusSubmitted(
  routeIds: number[],
  busSubmissions: BusSubmissionsMap,
): boolean {
  if (!routeIds.length) return false;
  return routeIds.every((id) => isRouteBusSubmitted(id, busSubmissions));
}

export async function loadBusAttendance(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  attendanceDate: string,
  runPeriod: "am" | "pm",
): Promise<{ records: BusAttendanceMap; submittedAt: string | null; busSubmissions: BusSubmissionsMap }> {
  const { data, error } = await supabase
    .from("transport_bus_attendance" as "profiles")
    .select("data, submitted_at")
    .eq("company_id", companyId)
    .eq("season", season)
    .eq("attendance_date", attendanceDate)
    .eq("run_period", runPeriod)
    .maybeSingle();

  if (error) {
    console.error("[Transport] Load bus attendance failed:", error.message);
    return { records: {}, submittedAt: null, busSubmissions: {} };
  }

  const payload = (data?.data ?? {}) as Record<string, unknown>;
  return {
    records: parseAttendanceMap(payload),
    submittedAt: (data?.submitted_at as string | null) ?? (payload.submittedAt as string | null) ?? null,
    busSubmissions: parseBusSubmissions(payload),
  };
}

export async function saveBusAttendance(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  attendanceDate: string,
  runPeriod: "am" | "pm",
  records: BusAttendanceMap,
  options?: {
    busSubmissions?: BusSubmissionsMap;
    submittedRouteId?: number;
    allRoutesSubmitted?: boolean;
    userId?: string | null;
  },
): Promise<boolean> {
  const hasRecords = Object.keys(records).length > 0;
  const hasSubmissions = Object.keys(options?.busSubmissions ?? {}).length > 0;
  const now = new Date().toISOString();

  if (!hasRecords && !hasSubmissions) {
    const { error } = await supabase
      .from("transport_bus_attendance" as "profiles")
      .delete()
      .eq("company_id", companyId)
      .eq("season", season)
      .eq("attendance_date", attendanceDate)
      .eq("run_period", runPeriod);
    if (error) {
      console.error("[Transport] Clear bus attendance failed:", error.message);
      return false;
    }
    return true;
  }

  const busSubmissions = { ...(options?.busSubmissions ?? {}) };
  if (options?.submittedRouteId != null) {
    busSubmissions[busSubmissionKey(options.submittedRouteId)] = {
      submittedAt: now,
      submittedBy: options.userId ?? null,
    };
  }

  const payload: Record<string, unknown> = {
    company_id: companyId,
    season,
    attendance_date: attendanceDate,
    run_period: runPeriod,
    data: { records, busSubmissions } as never,
    updated_by: options?.userId ?? null,
    updated_at: now,
  };
  if (options?.allRoutesSubmitted) {
    payload.submitted_at = now;
    payload.submitted_by = options.userId ?? null;
  }

  const { error } = await supabase.from("transport_bus_attendance" as "profiles").upsert(payload as never);

  if (error) {
    console.error("[Transport] Save bus attendance failed:", error.message);
    return false;
  }
  return true;
}

/** Campers scheduled on a route for attendance (from effective core stops). */
export function campersOnRoute(
  routeId: number,
  coreStops: { name: string; camperNames?: string[] }[],
): { key: string; name: string; stopName: string }[] {
  const out: { key: string; name: string; stopName: string }[] = [];
  const seen = new Set<string>();
  for (const stop of coreStops) {
    const names = stop.camperNames?.length ? stop.camperNames : [stop.name];
    for (const name of names) {
      const key = attendanceRecordKey(routeId, name);
      if (seen.has(key)) continue;
      seen.add(key);
      out.push({ key, name, stopName: stop.name });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function compareBusLabels(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}
