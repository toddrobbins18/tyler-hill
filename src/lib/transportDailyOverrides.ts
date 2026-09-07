import type { SupabaseClient } from "@supabase/supabase-js";

export interface TransportRouteStop {
  name: string;
  address: string;
  lat: number;
  lng: number;
  pickupTime: string;
  passengers: number;
  camperNames?: string[];
}

export type TransportManualOverrides = {
  excluded: Record<number, string[]>;
  added: Record<number, TransportRouteStop[]>;
};

export type TransportExceptionSource =
  | "parent_absence"
  | "parent_bus_change"
  | "office_change"
  | "nurse_sent_home";

export type TransportException = {
  source: TransportExceptionSource;
  camperName: string;
  label: string;
  detail?: string;
};

export const emptyManualOverrides = (): TransportManualOverrides => ({
  excluded: {},
  added: {},
});

export const todayDateString = () => new Date().toISOString().slice(0, 10);

const normName = (name: string) => name.trim().toLowerCase();

export function parseManualOverrides(raw: unknown): TransportManualOverrides {
  if (!raw || typeof raw !== "object") return emptyManualOverrides();
  const obj = raw as Record<string, unknown>;
  const excluded: Record<number, string[]> = {};
  const added: Record<number, TransportRouteStop[]> = {};

  if (obj.excluded && typeof obj.excluded === "object") {
    for (const [k, v] of Object.entries(obj.excluded as Record<string, unknown>)) {
      if (Array.isArray(v)) excluded[Number(k)] = v.map(String);
    }
  }
  if (obj.added && typeof obj.added === "object") {
    for (const [k, v] of Object.entries(obj.added as Record<string, unknown>)) {
      if (Array.isArray(v)) added[Number(k)] = v as TransportRouteStop[];
    }
  }
  return { excluded, added };
}

export async function loadManualOverrides(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  overrideDate: string,
): Promise<TransportManualOverrides> {
  const { data, error } = await supabase
    .from("transport_daily_overrides" as "profiles")
    .select("data")
    .eq("company_id", companyId)
    .eq("season", season)
    .eq("override_date", overrideDate)
    .maybeSingle();

  if (error) {
    console.error("[Transport] Load daily overrides failed:", error.message);
    return emptyManualOverrides();
  }
  return parseManualOverrides(data?.data);
}

export async function saveManualOverrides(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  overrideDate: string,
  overrides: TransportManualOverrides,
  userId?: string | null,
): Promise<boolean> {
  const hasData =
    Object.values(overrides.excluded).some((a) => a.length > 0)
    || Object.values(overrides.added).some((a) => a.length > 0);

  if (!hasData) {
    const { error } = await supabase
      .from("transport_daily_overrides" as "profiles")
      .delete()
      .eq("company_id", companyId)
      .eq("season", season)
      .eq("override_date", overrideDate);
    if (error) {
      console.error("[Transport] Clear daily overrides failed:", error.message);
      return false;
    }
    return true;
  }

  const { error } = await supabase.from("transport_daily_overrides" as "profiles").upsert({
    company_id: companyId,
    season,
    override_date: overrideDate,
    data: overrides as never,
    updated_by: userId ?? null,
    updated_at: new Date().toISOString(),
  } as never);

  if (error) {
    console.error("[Transport] Save daily overrides failed:", error.message);
    return false;
  }
  return true;
}

export async function fetchTransportExceptions(
  supabase: SupabaseClient,
  companyId: string,
  overrideDate: string,
): Promise<TransportException[]> {
  const out: TransportException[] = [];
  const seen = new Set<string>();

  const add = (item: TransportException) => {
    const key = `${item.source}:${normName(item.camperName)}`;
    if (!item.camperName.trim() || seen.has(key)) return;
    seen.add(key);
    out.push(item);
  };

  const [{ data: absences }, { data: pickups }, { data: office }, { data: nurse }] = await Promise.all([
    supabase
      .from("absences")
      .select("absence_type, reason, children:camper_id(name)")
      .eq("company_id", companyId)
      .eq("absence_date", overrideDate)
      .eq("status", "acknowledged"),
    supabase
      .from("pickup_changes")
      .select("change_type, notes, children:camper_id(name)")
      .eq("company_id", companyId)
      .eq("change_date", overrideDate)
      .in("status", ["acknowledged", "completed"])
      .eq("change_type", "bus_change"),
    supabase
      .from("office_transport_changes")
      .select("camper_name, note")
      .eq("company_id", companyId)
      .eq("change_date", overrideDate),
    supabase
      .from("nurse_records")
      .select("camper_name, reason, sent_home")
      .eq("company_id", companyId)
      .eq("date", overrideDate)
      .eq("sent_home", true),
  ]);

  for (const row of absences ?? []) {
    const name = (row as { children?: { name?: string } }).children?.name?.trim();
    if (!name) continue;
    const type = (row as { absence_type?: string }).absence_type ?? "absent";
    add({
      source: "parent_absence",
      camperName: name,
      label: "Parent absence (acknowledged)",
      detail: type,
    });
  }

  for (const row of pickups ?? []) {
    const name = (row as { children?: { name?: string } }).children?.name?.trim();
    if (!name) continue;
    add({
      source: "parent_bus_change",
      camperName: name,
      label: "Parent bus change (acknowledged)",
      detail: (row as { notes?: string }).notes ?? undefined,
    });
  }

  for (const row of office ?? []) {
    const name = (row as { camper_name?: string }).camper_name?.trim();
    if (!name) continue;
    add({
      source: "office_change",
      camperName: name,
      label: "Office phone change",
      detail: (row as { note?: string }).note,
    });
  }

  for (const row of nurse ?? []) {
    const name = (row as { camper_name?: string }).camper_name?.trim();
    if (!name) continue;
    add({
      source: "nurse_sent_home",
      camperName: name,
      label: "Nurse — sent home",
      detail: (row as { reason?: string }).reason ?? undefined,
    });
  }

  return out;
}

/** Apply manual + external exceptions to a route's base stops. */
export function applyRouteOverrides(
  baseStops: TransportRouteStop[],
  routeId: number,
  manual: TransportManualOverrides,
  excludedCampers: Set<string>,
): TransportRouteStop[] {
  const excludedAddresses = new Set(manual.excluded[routeId] ?? []);
  const filtered = baseStops
    .filter((s) => !excludedAddresses.has(s.address))
    .map((s) => {
      const names = (s.camperNames?.length ? s.camperNames : [s.name]).filter(
        (n) => !excludedCampers.has(normName(n)),
      );
      if (!names.length) return null;
      if (names.length === (s.camperNames?.length ? s.camperNames.length : 1)) return s;
      return {
        ...s,
        name: names[0],
        camperNames: names,
        passengers: names.length,
      };
    })
    .filter((s): s is TransportRouteStop => s != null);

  const added = (manual.added[routeId] ?? [])
    .map((s) => {
      const names = (s.camperNames?.length ? s.camperNames : [s.name]).filter(
        (n) => !excludedCampers.has(normName(n)),
      );
      if (!names.length) return null;
      return { ...s, name: names[0], camperNames: names, passengers: names.length };
    })
    .filter((s): s is TransportRouteStop => s != null);

  return [...filtered, ...added];
}

export function excludedCamperSet(exceptions: TransportException[]): Set<string> {
  return new Set(exceptions.map((e) => normName(e.camperName)));
}
