import type { SupabaseClient } from "@supabase/supabase-js";

export type BusAttendanceStatus = "present" | "absent";

export type BusAttendanceMap = Record<string, BusAttendanceStatus>;

export function attendanceRecordKey(routeId: number, camperName: string): string {
  return `${routeId}|${camperName.trim().toLowerCase()}`;
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
    if (key === "submittedAt") continue;
    if (val === "present" || val === "absent") map[key] = val;
  }
  return map;
}

export type BusAttendancePayload = {
  records: BusAttendanceMap;
  submittedAt?: string | null;
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

export async function loadBusAttendance(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  attendanceDate: string,
  runPeriod: "am" | "pm",
): Promise<{ records: BusAttendanceMap; submittedAt: string | null }> {
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
    return { records: {}, submittedAt: null };
  }

  const payload = (data?.data ?? {}) as Record<string, unknown>;
  return {
    records: parseAttendanceMap(payload),
    submittedAt: (data?.submitted_at as string | null) ?? (payload.submittedAt as string | null) ?? null,
  };
}

export async function saveBusAttendance(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  attendanceDate: string,
  runPeriod: "am" | "pm",
  records: BusAttendanceMap,
  options?: { submitted?: boolean; userId?: string | null },
): Promise<boolean> {
  const hasRecords = Object.keys(records).length > 0;
  const now = new Date().toISOString();

  if (!hasRecords && !options?.submitted) {
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

  const payload: Record<string, unknown> = {
    company_id: companyId,
    season,
    attendance_date: attendanceDate,
    run_period: runPeriod,
    data: { records } as never,
    updated_by: options?.userId ?? null,
    updated_at: now,
  };
  if (options?.submitted) {
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
