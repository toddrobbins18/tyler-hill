import type { SupabaseClient } from "@supabase/supabase-js";
import {
  campDateFromTimestamp,
  campYmdToUtcEndIso,
  campYmdToUtcStartIso,
  formatCampTime,
  swimLessonBusRun,
} from "@/lib/campTime";

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
  | "nurse_sent_home"
  | "swim_lesson";

export type TransportRunPeriod = "am" | "pm";

export type TransportException = {
  source: TransportExceptionSource;
  camperName: string;
  label: string;
  detail?: string;
  /** When set, exception only removes camper from that run (default: both runs). */
  appliesTo?: TransportRunPeriod;
  /** Parent/office workflow status when relevant (report only). */
  workflowStatus?: string;
  /** Whether this change is currently applied on the transport map. */
  appliedToRoutes?: boolean;
};

export const emptyManualOverrides = (): TransportManualOverrides => ({
  excluded: {},
  added: {},
});

export const todayDateString = () => new Date().toISOString().slice(0, 10);

const normName = (name: string) => name.trim().toLowerCase();

export { campDateFromTimestamp, swimLessonBusRun };

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
    const key = `${item.source}:${normName(item.camperName)}:${item.appliesTo ?? "both"}`;
    if (!item.camperName.trim() || seen.has(key)) return;
    seen.add(key);
    out.push(item);
  };

  const [{ data: absences }, { data: pickups }, { data: office }, { data: nurse }, { data: swimLessons }] =
    await Promise.all([
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
    supabase
      .from("swim_lessons")
      .select(
        "scheduled_at, duration_minutes, location, instructor, parent_confirmed, status, children:camper_id(name)",
      )
      .eq("company_id", companyId)
      .eq("parent_confirmed", true)
      .neq("status", "cancelled")
      .gte("scheduled_at", campYmdToUtcStartIso(overrideDate))
      .lt("scheduled_at", campYmdToUtcEndIso(overrideDate)),
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

  for (const row of swimLessons ?? []) {
    const scheduledAt = (row as { scheduled_at?: string }).scheduled_at;
    const name = (row as { children?: { name?: string } }).children?.name?.trim();
    if (!name || !scheduledAt) continue;
    if (campDateFromTimestamp(scheduledAt) !== overrideDate) continue;

    const run = swimLessonBusRun(scheduledAt);
    const location = (row as { location?: string | null }).location;
    const instructor = (row as { instructor?: string | null }).instructor;
    const duration = (row as { duration_minutes?: number }).duration_minutes ?? 30;
    const timeLabel = formatCampTime(scheduledAt);
    const place = location?.trim() || "Swim lesson";
    const coach = instructor?.trim();

    add({
      source: "swim_lesson",
      camperName: name,
      label: `Swim lesson — no ${run.toUpperCase()} bus`,
      detail: coach
        ? `${timeLabel} · ${place} · ${duration} min · ${coach}`
        : `${timeLabel} · ${place} · ${duration} min`,
      appliesTo: run,
    });
  }

  return out;
}

/** All transport-related changes for a date — includes pending items not yet on routes. */
export async function fetchTransportExceptionsForReport(
  supabase: SupabaseClient,
  companyId: string,
  overrideDate: string,
): Promise<TransportException[]> {
  const out: TransportException[] = [];
  const seen = new Set<string>();

  const add = (item: TransportException) => {
    const key = `${item.source}:${normName(item.camperName)}:${item.appliesTo ?? "both"}:${item.workflowStatus ?? ""}`;
    if (!item.camperName.trim() || seen.has(key)) return;
    seen.add(key);
    out.push(item);
  };

  const [{ data: absences }, { data: pickups }, { data: office }, { data: nurse }, { data: swimLessons }] =
    await Promise.all([
      supabase
        .from("absences")
        .select("absence_type, reason, status, children:camper_id(name)")
        .eq("company_id", companyId)
        .eq("absence_date", overrideDate)
        .neq("status", "cancelled"),
      supabase
        .from("pickup_changes")
        .select("change_type, notes, status, children:camper_id(name)")
        .eq("company_id", companyId)
        .eq("change_date", overrideDate)
        .eq("change_type", "bus_change")
        .neq("status", "cancelled"),
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
      supabase
        .from("swim_lessons")
        .select(
          "scheduled_at, duration_minutes, location, instructor, parent_confirmed, status, children:camper_id(name)",
        )
        .eq("company_id", companyId)
        .neq("status", "cancelled")
        .gte("scheduled_at", campYmdToUtcStartIso(overrideDate))
        .lt("scheduled_at", campYmdToUtcEndIso(overrideDate)),
    ]);

  for (const row of absences ?? []) {
    const name = (row as { children?: { name?: string } }).children?.name?.trim();
    if (!name) continue;
    const status = (row as { status?: string }).status ?? "submitted";
    const type = (row as { absence_type?: string }).absence_type ?? "absent";
    const acknowledged = status === "acknowledged";
    add({
      source: "parent_absence",
      camperName: name,
      label: acknowledged ? "Parent absence (acknowledged)" : "Parent absence (submitted)",
      detail: type,
      workflowStatus: status,
      appliedToRoutes: acknowledged,
    });
  }

  for (const row of pickups ?? []) {
    const name = (row as { children?: { name?: string } }).children?.name?.trim();
    if (!name) continue;
    const status = (row as { status?: string }).status ?? "submitted";
    const applied = status === "acknowledged" || status === "completed";
    add({
      source: "parent_bus_change",
      camperName: name,
      label: applied ? "Parent bus change (acknowledged)" : "Parent bus change (submitted)",
      detail: (row as { notes?: string }).notes ?? undefined,
      workflowStatus: status,
      appliedToRoutes: applied,
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
      workflowStatus: "logged",
      appliedToRoutes: true,
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
      workflowStatus: "sent home",
      appliedToRoutes: true,
    });
  }

  for (const row of swimLessons ?? []) {
    const scheduledAt = (row as { scheduled_at?: string }).scheduled_at;
    const name = (row as { children?: { name?: string } }).children?.name?.trim();
    if (!name || !scheduledAt) continue;
    if (campDateFromTimestamp(scheduledAt) !== overrideDate) continue;

    const confirmed = (row as { parent_confirmed?: boolean }).parent_confirmed === true;
    const run = swimLessonBusRun(scheduledAt);
    const location = (row as { location?: string | null }).location;
    const instructor = (row as { instructor?: string | null }).instructor;
    const duration = (row as { duration_minutes?: number }).duration_minutes ?? 30;
    const timeLabel = formatCampTime(scheduledAt);
    const place = location?.trim() || "Swim lesson";
    const coach = instructor?.trim();

    add({
      source: "swim_lesson",
      camperName: name,
      label: confirmed
        ? `Swim lesson — no ${run.toUpperCase()} bus`
        : `Swim lesson — pending parent confirm (no ${run.toUpperCase()} bus when confirmed)`,
      detail: coach
        ? `${timeLabel} · ${place} · ${duration} min · ${coach}`
        : `${timeLabel} · ${place} · ${duration} min`,
      appliesTo: run,
      workflowStatus: confirmed ? "parent confirmed" : "awaiting parent confirm",
      appliedToRoutes: confirmed,
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

export function excludedCamperSet(
  exceptions: TransportException[],
  runPeriod?: TransportRunPeriod,
): Set<string> {
  return new Set(
    exceptions
      .filter((e) => {
        if (!runPeriod || !e.appliesTo) return true;
        return e.appliesTo === runPeriod;
      })
      .map((e) => normName(e.camperName)),
  );
}

export type TransportRouteMeta = {
  id: number;
  name: string;
  bus: string;
};

const EXCEPTION_SOURCE_LABELS: Record<TransportExceptionSource, string> = {
  parent_absence: "Parent absence",
  parent_bus_change: "Parent bus change",
  office_change: "Office change",
  nurse_sent_home: "Nurse — sent home",
  swim_lesson: "Swim lesson",
};

function runPeriodLabel(appliesTo?: TransportRunPeriod): string {
  if (!appliesTo) return "AM & PM";
  return appliesTo.toUpperCase();
}

function camperNamesAtStop(stop: TransportRouteStop): string[] {
  return stop.camperNames?.length ? stop.camperNames : [stop.name];
}

function findCamperInRoutes(
  camperName: string,
  routeMeta: TransportRouteMeta[],
  coreStops: Record<number, TransportRouteStop[]>,
): { routeName: string; bus: string; address: string } | null {
  const target = normName(camperName);
  for (const meta of routeMeta) {
    for (const stop of coreStops[meta.id] ?? []) {
      if (camperNamesAtStop(stop).some((n) => normName(n) === target)) {
        return { routeName: meta.name, bus: meta.bus, address: stop.address };
      }
    }
  }
  return null;
}

/** CSV rows for all transport changes on a given date (auto exceptions + manual overrides). */
export function buildTransportExceptionsReportRows(options: {
  overrideDate: string;
  exceptions: TransportException[];
  manual: TransportManualOverrides;
  routeMeta: TransportRouteMeta[];
  coreStops: Record<number, TransportRouteStop[]>;
}): (string | number)[][] {
  const { overrideDate, exceptions, manual, routeMeta, coreStops } = options;
  const rows: (string | number)[][] = [
    [
      "Date",
      "Run",
      "Camper",
      "Change Source",
      "Description",
      "Status",
      "On Routes",
      "Route",
      "Bus",
      "Stop / Address",
      "Notes",
    ],
  ];

  for (const ex of exceptions) {
    const scheduled = findCamperInRoutes(ex.camperName, routeMeta, coreStops);
    rows.push([
      overrideDate,
      runPeriodLabel(ex.appliesTo),
      ex.camperName,
      EXCEPTION_SOURCE_LABELS[ex.source],
      ex.label,
      ex.workflowStatus ?? "",
      ex.appliedToRoutes === false ? "No" : "Yes",
      scheduled?.routeName ?? "",
      scheduled?.bus ?? "",
      scheduled?.address ?? "",
      ex.detail ?? "",
    ]);
  }

  for (const meta of routeMeta) {
    for (const address of manual.excluded[meta.id] ?? []) {
      const baseStop = (coreStops[meta.id] ?? []).find((s) => s.address === address);
      const campers = baseStop ? camperNamesAtStop(baseStop).join(", ") : "";
      rows.push([
        overrideDate,
        "AM & PM",
        campers || "(stop)",
        "Manual override",
        "Stop excluded for today",
        "saved",
        "Yes",
        meta.name,
        meta.bus,
        address,
        baseStop?.name ?? "",
      ]);
    }

    for (const stop of manual.added[meta.id] ?? []) {
      rows.push([
        overrideDate,
        "AM & PM",
        camperNamesAtStop(stop).join(", "),
        "Manual override",
        "Stop added for today",
        "saved",
        "Yes",
        meta.name,
        meta.bus,
        stop.address,
        stop.pickupTime !== "TBD" ? stop.pickupTime : "",
      ]);
    }
  }

  if (rows.length === 1) {
    rows.push([
      `(No transport changes for ${overrideDate})`,
      "",
      "",
      "",
      "Try another date on the Map tab, or check Parent Portal / Swim / Office Changes",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
  }

  return rows;
}
