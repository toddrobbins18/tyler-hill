import type { SupabaseClient } from "@supabase/supabase-js";
import type { BusAttendanceMap, BusAttendanceStatus } from "@/lib/transportBusAttendance";
import { attendanceStatusLabel } from "@/lib/transportBusAttendance";

export type GroupAttendanceStatus = "present" | "absent";
export type GroupAttendanceMap = Record<string, GroupAttendanceStatus>;

export type GroupRosterCamper = {
  id: string;
  name: string;
  groupName: string;
  key: string;
};

export type AttendanceConflict = {
  camperName: string;
  groupName: string;
  busStatus: "present" | "absent" | "unmarked";
  groupStatus: GroupAttendanceStatus;
};

export const normCamperName = (name: string) => name.trim().toLowerCase();

export function groupAttendanceRecordKey(groupName: string, camperName: string): string {
  return `${groupName.trim().toLowerCase()}|${normCamperName(camperName)}`;
}

export function parseGroupAttendanceMap(raw: unknown): GroupAttendanceMap {
  if (!raw || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const map: GroupAttendanceMap = {};
  const source = obj.records && typeof obj.records === "object" && !Array.isArray(obj.records)
    ? (obj.records as Record<string, unknown>)
    : obj;
  for (const [key, val] of Object.entries(source)) {
    if (key === "submittedAt") continue;
    if (val === "present" || val === "absent") map[key] = val;
  }
  return map;
}

export async function loadGroupRoster(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
): Promise<GroupRosterCamper[]> {
  const { data, error } = await supabase
    .from("children")
    .select("id, name, group_name")
    .eq("company_id", companyId)
    .eq("season", season)
    .neq("status", "inactive");

  if (error) {
    console.error("[Transport] Load group roster failed:", error.message);
    return [];
  }

  const out: GroupRosterCamper[] = [];
  for (const row of data ?? []) {
    const name = (row as { name?: string }).name?.trim();
    const groupName = (row as { group_name?: string }).group_name?.trim() || "Unassigned";
    if (!name) continue;
    out.push({
      id: (row as { id: string }).id,
      name,
      groupName,
      key: groupAttendanceRecordKey(groupName, name),
    });
  }
  return out.sort((a, b) =>
    a.groupName.localeCompare(b.groupName) || a.name.localeCompare(b.name),
  );
}

export async function loadGroupAttendance(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  attendanceDate: string,
): Promise<{ records: GroupAttendanceMap; submittedAt: string | null }> {
  const { data, error } = await supabase
    .from("transport_group_attendance" as "profiles")
    .select("data, submitted_at")
    .eq("company_id", companyId)
    .eq("season", season)
    .eq("attendance_date", attendanceDate)
    .maybeSingle();

  if (error) {
    console.error("[Transport] Load group attendance failed:", error.message);
    return { records: {}, submittedAt: null };
  }

  const payload = (data?.data ?? {}) as Record<string, unknown>;
  return {
    records: parseGroupAttendanceMap(payload),
    submittedAt: (data?.submitted_at as string | null) ?? null,
  };
}

export async function saveGroupAttendance(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  attendanceDate: string,
  records: GroupAttendanceMap,
  options?: { submitted?: boolean; userId?: string | null },
): Promise<boolean> {
  const hasRecords = Object.keys(records).length > 0;
  const now = new Date().toISOString();

  if (!hasRecords && !options?.submitted) {
    const { error } = await supabase
      .from("transport_group_attendance" as "profiles")
      .delete()
      .eq("company_id", companyId)
      .eq("season", season)
      .eq("attendance_date", attendanceDate);
    if (error) {
      console.error("[Transport] Clear group attendance failed:", error.message);
      return false;
    }
    return true;
  }

  const payload: Record<string, unknown> = {
    company_id: companyId,
    season,
    attendance_date: attendanceDate,
    data: { records } as never,
    updated_by: options?.userId ?? null,
    updated_at: now,
  };
  if (options?.submitted) {
    payload.submitted_at = now;
    payload.submitted_by = options.userId ?? null;
  }

  const { error } = await supabase.from("transport_group_attendance" as "profiles").upsert(payload as never);
  if (error) {
    console.error("[Transport] Save group attendance failed:", error.message);
    return false;
  }
  return true;
}

/** Best bus status per camper name for the selected AM/PM run. */
export function buildCamperBusStatus(
  busRoster: { key: string; name: string }[],
  busAttendance: BusAttendanceMap,
): Map<string, BusAttendanceStatus | "unmarked"> {
  const map = new Map<string, BusAttendanceStatus | "unmarked">();
  for (const c of busRoster) {
    const norm = normCamperName(c.name);
    if (map.has(norm)) continue;
    const label = attendanceStatusLabel(c.key, busAttendance);
    map.set(
      norm,
      label === "Present" ? "present" : label === "Absent" ? "absent" : "unmarked",
    );
  }
  return map;
}

export function findAttendanceConflicts(
  camperBusStatus: Map<string, BusAttendanceStatus | "unmarked">,
  groupRoster: GroupRosterCamper[],
  groupAttendance: GroupAttendanceMap,
): AttendanceConflict[] {
  const conflicts: AttendanceConflict[] = [];
  for (const c of groupRoster) {
    const bus = camperBusStatus.get(normCamperName(c.name)) ?? "unmarked";
    const group = groupAttendance[c.key];
    if (!group || bus === "unmarked") continue;
    if (bus !== group) {
      conflicts.push({
        camperName: c.name,
        groupName: c.groupName,
        busStatus: bus,
        groupStatus: group,
      });
    }
  }
  return conflicts.sort((a, b) => a.camperName.localeCompare(b.camperName));
}

export function groupAttendanceStatusLabel(
  key: string,
  map: GroupAttendanceMap,
): "Present" | "Absent" | "Unmarked" {
  const s = map[key];
  if (s === "present") return "Present";
  if (s === "absent") return "Absent";
  return "Unmarked";
}
