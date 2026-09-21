import type { SupabaseClient } from "@supabase/supabase-js";
import { campTodayDateString } from "@/lib/parentPortalCutoff";
import { campYmdToUtcEndIso, campYmdToUtcStartIso } from "@/lib/campTime";
import { allRoutesBusSubmitted, loadBusAttendance } from "@/lib/transportBusAttendance";
import { loadTransportRunBoard } from "@/lib/transportRunBoard";

export const PICKUP_CHANGE_LABELS: Record<string, string> = {
  early_pickup: "Early Pickup",
  late_stay: "Late Stay",
  alternate_guardian: "Alternate Guardian",
  bus_change: "Bus / Transport Change",
  other: "Other",
};

export const ABSENCE_TYPE_LABELS: Record<string, string> = {
  absent: "Absent",
  late_arrival: "Late Arrival",
  leaving_early: "Leaving Early",
};

export type DismissalPickupRow = {
  id: string;
  change_date: string;
  change_type: string;
  pickup_time: string | null;
  pickup_person_name: string | null;
  notes: string | null;
  status: string;
  familyName: string;
  camperName: string;
};

export type DismissalAbsenceRow = {
  id: string;
  absence_date: string;
  absence_type: string;
  arrival_time: string | null;
  reason: string | null;
  status: string;
  familyName: string;
  camperName: string;
};

export type DismissalOfficeRow = {
  id: string;
  change_date: string;
  camper_name: string;
  group_division: string | null;
  note: string;
  done: boolean;
  created_at: string;
};

export type DismissalNurseRow = {
  id: string;
  date: string;
  camper_name: string;
  reason: string | null;
  transport_status: string;
};

export type DismissalSwimRow = {
  id: string;
  scheduled_at: string;
  camperName: string;
  instructor: string | null;
  transport_status: string;
};

export type DismissalDashboardData = {
  selectedDate: string;
  pendingPickups: DismissalPickupRow[];
  pendingAbsences: DismissalAbsenceRow[];
  pendingNurse: DismissalNurseRow[];
  pendingSwim: DismissalSwimRow[];
  approvedPickups: DismissalPickupRow[];
  approvedAbsences: DismissalAbsenceRow[];
  approvedNurse: DismissalNurseRow[];
  approvedSwim: DismissalSwimRow[];
  officeChanges: DismissalOfficeRow[];
  allPendingCount: number;
  routeCount: number;
  busAmSubmitted: boolean;
  busPmSubmitted: boolean;
};

function mapPickup(row: Record<string, unknown>): DismissalPickupRow {
  const families = row.families as { family_name?: string } | null;
  const children = row.children as { name?: string } | null;
  return {
    id: String(row.id),
    change_date: String(row.change_date ?? ""),
    change_type: String(row.change_type ?? "other"),
    pickup_time: (row.pickup_time as string | null) ?? null,
    pickup_person_name: (row.pickup_person_name as string | null) ?? null,
    notes: (row.notes as string | null) ?? null,
    status: String(row.status ?? "submitted"),
    familyName: families?.family_name ?? "—",
    camperName: children?.name ?? "—",
  };
}

function mapAbsence(row: Record<string, unknown>): DismissalAbsenceRow {
  const families = row.families as { family_name?: string } | null;
  const children = row.children as { name?: string } | null;
  return {
    id: String(row.id),
    absence_date: String(row.absence_date ?? ""),
    absence_type: String(row.absence_type ?? "absent"),
    arrival_time: (row.arrival_time as string | null) ?? null,
    reason: (row.reason as string | null) ?? null,
    status: String(row.status ?? "submitted"),
    familyName: families?.family_name ?? "—",
    camperName: children?.name ?? "—",
  };
}

export async function fetchDismissalDashboard(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  selectedDate: string = campTodayDateString(),
): Promise<DismissalDashboardData> {
  const [
    pickupRes,
    absenceRes,
    nurseRes,
    swimRes,
    officeRes,
    allPendingPickupRes,
    allPendingAbsenceRes,
    allPendingNurseRes,
    allPendingSwimRes,
    board,
    busAm,
    busPm,
  ] = await Promise.all([
    supabase
      .from("pickup_changes")
      .select(`
        id, change_date, change_type, pickup_time, pickup_person_name, notes, status,
        families:family_id(family_name),
        children:camper_id(name)
      `)
      .eq("company_id", companyId)
      .eq("change_date", selectedDate)
      .order("created_at", { ascending: false }),
    supabase
      .from("absences")
      .select(`
        id, absence_date, absence_type, arrival_time, reason, status,
        families:family_id(family_name),
        children:camper_id(name)
      `)
      .eq("company_id", companyId)
      .eq("absence_date", selectedDate)
      .order("created_at", { ascending: false }),
    supabase
      .from("nurse_records")
      .select("id, date, camper_name, reason, transport_status")
      .eq("company_id", companyId)
      .eq("date", selectedDate)
      .eq("sent_home", true)
      .order("created_at", { ascending: false }),
    supabase
      .from("swim_lessons")
      .select("id, scheduled_at, instructor, transport_status, children:camper_id(name)")
      .eq("company_id", companyId)
      .eq("parent_confirmed", true)
      .neq("status", "cancelled")
      .gte("scheduled_at", campYmdToUtcStartIso(selectedDate))
      .lt("scheduled_at", campYmdToUtcEndIso(selectedDate))
      .order("scheduled_at", { ascending: true }),
    supabase
      .from("office_transport_changes")
      .select("id, change_date, camper_name, group_division, note, done, created_at")
      .eq("company_id", companyId)
      .eq("change_date", selectedDate)
      .order("created_at", { ascending: false }),
    supabase
      .from("pickup_changes")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "submitted"),
    supabase
      .from("absences")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("status", "submitted"),
    supabase
      .from("nurse_records")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("sent_home", true)
      .eq("transport_status", "submitted"),
    supabase
      .from("swim_lessons")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("parent_confirmed", true)
      .eq("transport_status", "submitted")
      .neq("status", "cancelled"),
    loadTransportRunBoard(supabase, companyId, season, selectedDate),
    loadBusAttendance(supabase, companyId, season, selectedDate, "am"),
    loadBusAttendance(supabase, companyId, season, selectedDate, "pm"),
  ]);

  const pickups = (pickupRes.data ?? []).map((r) => mapPickup(r as Record<string, unknown>));
  const absences = (absenceRes.data ?? []).map((r) => mapAbsence(r as Record<string, unknown>));
  const nurseRows: DismissalNurseRow[] = (nurseRes.data ?? []).map((r) => ({
    id: String(r.id),
    date: String(r.date ?? ""),
    camper_name: String(r.camper_name ?? "—"),
    reason: (r.reason as string | null) ?? null,
    transport_status: String(r.transport_status ?? "submitted"),
  }));
  const swimRows: DismissalSwimRow[] = (swimRes.data ?? []).map((r) => ({
    id: String(r.id),
    scheduled_at: String(r.scheduled_at ?? ""),
    camperName: (r.children as { name?: string } | null)?.name ?? "—",
    instructor: (r.instructor as string | null) ?? null,
    transport_status: String(r.transport_status ?? "submitted"),
  }));

  const routeIds = board.routeMeta.map((r) => r.id);

  return {
    selectedDate,
    pendingPickups: pickups.filter((p) => p.status === "submitted"),
    pendingAbsences: absences.filter((a) => a.status === "submitted"),
    pendingNurse: nurseRows.filter((n) => n.transport_status === "submitted"),
    pendingSwim: swimRows.filter((s) => s.transport_status === "submitted"),
    approvedPickups: pickups.filter((p) => p.status === "acknowledged" || p.status === "completed"),
    approvedAbsences: absences.filter((a) => a.status === "acknowledged"),
    approvedNurse: nurseRows.filter((n) => n.transport_status === "acknowledged"),
    approvedSwim: swimRows.filter((s) => s.transport_status === "acknowledged"),
    officeChanges: (officeRes.data ?? []) as DismissalOfficeRow[],
    allPendingCount:
      (allPendingPickupRes.count ?? 0) +
      (allPendingAbsenceRes.count ?? 0) +
      (allPendingNurseRes.count ?? 0) +
      (allPendingSwimRes.count ?? 0),
    routeCount: board.routeMeta.length,
    busAmSubmitted: routeIds.length > 0
      ? allRoutesBusSubmitted(routeIds, busAm.busSubmissions)
      : Boolean(busAm.submittedAt),
    busPmSubmitted: routeIds.length > 0
      ? allRoutesBusSubmitted(routeIds, busPm.busSubmissions)
      : Boolean(busPm.submittedAt),
  };
}

export async function approveDismissalPickup(supabase: SupabaseClient, id: string) {
  return supabase.from("pickup_changes").update({ status: "acknowledged" }).eq("id", id);
}

export async function approveDismissalAbsence(supabase: SupabaseClient, id: string) {
  return supabase.from("absences").update({ status: "acknowledged" }).eq("id", id);
}

export async function approveDismissalNurse(supabase: SupabaseClient, id: string) {
  return supabase.from("nurse_records").update({ transport_status: "acknowledged" }).eq("id", id);
}

export async function approveDismissalSwim(supabase: SupabaseClient, id: string) {
  return supabase.from("swim_lessons").update({ transport_status: "acknowledged" }).eq("id", id);
}

export async function toggleOfficeChangeDone(supabase: SupabaseClient, id: string, done: boolean) {
  return supabase.from("office_transport_changes").update({ done }).eq("id", id);
}

/** Tables watched for live front-office updates. */
export const DISMISSAL_REALTIME_TABLES = [
  "pickup_changes",
  "absences",
  "nurse_records",
  "swim_lessons",
  "office_transport_changes",
  "transport_bus_attendance",
] as const;
