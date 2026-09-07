import type { SupabaseClient } from "@supabase/supabase-js";
import { CAMP_TIMEZONE } from "@/lib/parentPortalCutoff";

export type BusCheckinRecord = {
  arrivedAt?: string | null;
  arrivedBy?: string | null;
  departedAt?: string | null;
  departedBy?: string | null;
};

export type BusCheckinMap = Record<string, BusCheckinRecord>;

export function busCheckinKey(routeId: number): string {
  return String(routeId);
}

export function parseBusCheckinMap(raw: unknown): BusCheckinMap {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const source = obj.records && typeof obj.records === "object" && !Array.isArray(obj.records)
    ? (obj.records as Record<string, unknown>)
    : obj;
  const map: BusCheckinMap = {};
  for (const [key, val] of Object.entries(source)) {
    if (!val || typeof val !== "object" || Array.isArray(val)) continue;
    const row = val as Record<string, unknown>;
    map[key] = {
      arrivedAt: typeof row.arrivedAt === "string" ? row.arrivedAt : null,
      arrivedBy: typeof row.arrivedBy === "string" ? row.arrivedBy : null,
      departedAt: typeof row.departedAt === "string" ? row.departedAt : null,
      departedBy: typeof row.departedBy === "string" ? row.departedBy : null,
    };
  }
  return map;
}

export async function loadBusCheckins(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  checkDate: string,
  runPeriod: "am" | "pm",
): Promise<BusCheckinMap> {
  const { data, error } = await supabase
    .from("transport_bus_checkins" as "profiles")
    .select("data")
    .eq("company_id", companyId)
    .eq("season", season)
    .eq("check_date", checkDate)
    .eq("run_period", runPeriod)
    .maybeSingle();

  if (error) {
    console.error("[Transport] Load bus check-ins failed:", error.message);
    return {};
  }

  return parseBusCheckinMap(data?.data ?? {});
}

export async function saveBusCheckins(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  checkDate: string,
  runPeriod: "am" | "pm",
  records: BusCheckinMap,
  userId?: string | null,
): Promise<boolean> {
  const hasRecords = Object.keys(records).length > 0;
  const now = new Date().toISOString();

  if (!hasRecords) {
    const { error } = await supabase
      .from("transport_bus_checkins" as "profiles")
      .delete()
      .eq("company_id", companyId)
      .eq("season", season)
      .eq("check_date", checkDate)
      .eq("run_period", runPeriod);
    if (error) {
      console.error("[Transport] Clear bus check-ins failed:", error.message);
      return false;
    }
    return true;
  }

  const { error } = await supabase.from("transport_bus_checkins" as "profiles").upsert({
    company_id: companyId,
    season,
    check_date: checkDate,
    run_period: runPeriod,
    data: { records } as never,
    updated_by: userId ?? null,
    updated_at: now,
  } as never);

  if (error) {
    console.error("[Transport] Save bus check-ins failed:", error.message);
    return false;
  }
  return true;
}

export function formatCheckinTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: CAMP_TIMEZONE,
    hour: "numeric",
    minute: "2-digit",
  }).format(d);
}
