import type { SupabaseClient } from "@supabase/supabase-js";
import { camperEnrolledInWeek } from "@/lib/enrollmentWeekCalendar";
import { findCamperRouteAssignment } from "@/lib/transportChangeSheets";
import {
  getCamperBusRunMode,
  formatCamperBusRunMode,
  type CamperBusRunSchedules,
} from "@/lib/transportCamperBusRun";
import { type ParentTransportCamper } from "@/lib/transportParentTransport";
import type { TransportRouteMeta, TransportRouteStop } from "@/lib/transportRoster";
import { withCounselorPickupStops } from "@/lib/transportCounselorPickup";
import { loadRouteReferenceAssignments } from "@/lib/routeReferenceWarehouse";
import type { BubbleSheetCamper } from "@/lib/transportBubbleSheetPdf";
import type { GroupReportCamper } from "@/lib/transportCampMinderReportsPdf";
import { encodeCamperBarcode } from "@/lib/transportReportPdfLayout";

export type TransportReportChildRow = {
  id: string;
  personId: string | null;
  name: string;
  groupName: string;
  gender: string | null;
  age: number | null;
  grade: string | null;
  session: string | null;
  divisionName: string | null;
  guardianName: string | null;
  guardianNameP2: string | null;
  guardianPhone: string | null;
  guardianEmail: string | null;
  homeAddress: string | null;
  enrolledWeeks?: number[];
};

export async function loadTransportReportChildren(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  options?: { enrollmentWeek?: number },
): Promise<TransportReportChildRow[]> {
  const { data, error } = await supabase
    .from("children")
    .select(
      "id, person_id, name, group_name, gender, age, grade, session, enrolled_weeks, guardian_name, guardian_name_p2, guardian_phone, guardian_email, home_address, division:division_id(name)",
    )
    .eq("company_id", companyId)
    .eq("season", season)
    .neq("status", "inactive");

  if (error) {
    console.error("[TransportReport] load children failed:", error.message);
    return [];
  }

  const out: TransportReportChildRow[] = [];
  for (const row of data ?? []) {
    const r = row as Record<string, unknown>;
    const name = String(r.name ?? "").trim();
    if (!name) continue;
    const enrolledWeeks = (r.enrolled_weeks as number[] | null) ?? undefined;
    const session = (r.session as string | null) ?? null;
    if (
      options?.enrollmentWeek != null &&
      !camperEnrolledInWeek(enrolledWeeks, session, options.enrollmentWeek)
    ) {
      continue;
    }
    const divisionRaw = r.division as { name?: string | null } | null;
    out.push({
      id: String(r.id),
      personId: r.person_id != null ? String(r.person_id).trim() : null,
      name,
      groupName: String(r.group_name ?? "").trim() || "Unassigned",
      gender: (r.gender as string | null) ?? null,
      age: typeof r.age === "number" ? r.age : null,
      grade: (r.grade as string | null) ?? null,
      session,
      divisionName: divisionRaw?.name?.trim() ?? null,
      guardianName: (r.guardian_name as string | null) ?? null,
      guardianNameP2: (r.guardian_name_p2 as string | null) ?? null,
      guardianPhone: (r.guardian_phone as string | null) ?? null,
      guardianEmail: (r.guardian_email as string | null) ?? null,
      homeAddress: (r.home_address as string | null)?.trim() || null,
      enrolledWeeks,
    });
  }

  return out.sort(
    (a, b) => a.groupName.localeCompare(b.groupName) || a.name.localeCompare(b.name),
  );
}

export function formatReportGenderLetter(gender: string | null): string {
  const g = (gender ?? "").trim().toLowerCase();
  if (g.startsWith("m") || g === "boy" || g === "boys") return "M";
  if (g.startsWith("f") || g === "girl" || g === "girls") return "F";
  return "—";
}

export function formatReportGenderAgeGrade(row: TransportReportChildRow): string {
  const letter = formatReportGenderLetter(row.gender);
  const gradeOrAge = row.grade?.trim() || (row.age != null ? String(row.age) : "");
  if (letter === "—" && !gradeOrAge) return "";
  return `(${letter}|${gradeOrAge || "—"})`;
}

export function townFromHomeAddress(address: string | null | undefined): string {
  const parts = (address ?? "")
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return "";
  return parts[parts.length - 2].replace(/\b[A-Z]{2}\b\s*\d{5}(-\d{4})?/i, "").trim();
}

export function formatReportParentContacts(row: TransportReportChildRow): string {
  const lines: string[] = [];
  const phone = row.guardianPhone?.trim();
  if (row.guardianName?.trim()) {
    lines.push(`Mother: ${row.guardianName.trim()}`);
    if (phone) lines.push(`(C: ${phone})`);
  } else if (phone) {
    lines.push(`(C: ${phone})`);
  }
  if (row.guardianNameP2?.trim()) {
    lines.push(`Father: ${row.guardianNameP2.trim()}`);
  }
  if (!lines.length && row.guardianEmail?.trim()) lines.push(row.guardianEmail.trim());
  return lines.join("\n") || "—";
}

export function formatReportProgramLine(row: TransportReportChildRow): string {
  const parts: string[] = [];
  if (row.session?.trim()) parts.push(row.session.trim());
  if (row.divisionName?.trim()) parts.push(row.divisionName.trim());
  return parts.join(" · ") || "—";
}

const normName = (name: string) => name.trim().toLowerCase();

export function resolveCamperTransportLine(
  camperName: string,
  routeMeta: TransportRouteMeta[],
  coreStops: Record<number, TransportRouteStop[]>,
  parentTransportCampers: ParentTransportCamper[],
  schedules: CamperBusRunSchedules,
): string {
  const pt = parentTransportCampers.find((c) => normName(c.name) === normName(camperName));
  if (pt && pt.routeId == null) {
    const legs = [pt.am ? "AM PT" : null, pt.pm ? "PM PT" : null].filter(Boolean).join(" · ");
    return legs || "Parent Transport (PT)";
  }
  const assignment = findCamperRouteAssignment(camperName, routeMeta, coreStops);
  const mode = getCamperBusRunMode(schedules, camperName);
  const modeLabel = formatCamperBusRunMode(mode);
  if (!assignment) return modeLabel;
  return `${assignment.bus} · ${modeLabel}`;
}

function staffDisplayName(fullName: string | null | undefined, email: string | null | undefined): string | null {
  const trimmed = fullName?.trim();
  if (trimmed) return trimmed;
  const local = email?.includes("@") ? email.split("@")[0]?.trim() : email?.trim();
  return local || null;
}

export async function loadGroupStaffNames(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  groupName: string,
): Promise<string[]> {
  const names = new Set<string>();
  const { data, error } = await supabase
    .from("children")
    .select("leader:leader_id(name)")
    .eq("company_id", companyId)
    .eq("season", season)
    .eq("group_name", groupName)
    .neq("status", "inactive");
  if (error) {
    console.error("[TransportReport] load group staff failed:", error.message);
  } else {
    for (const row of data ?? []) {
      const leader = (row as { leader?: { name?: string | null } | null }).leader;
      const name = leader?.name?.trim();
      if (name) names.add(name);
    }
  }

  const counselors = await supabase
    .from("profiles")
    .select("full_name, email, assigned_groups")
    .eq("company_id", companyId);
  if (!counselors.error) {
    const needle = groupName.trim().toLowerCase();
    for (const row of counselors.data ?? []) {
      const assigned = ((row as { assigned_groups?: string[] | null }).assigned_groups ?? [])
        .map((name) => name.trim())
        .filter(Boolean);
      if (!assigned.some((name) => name.toLowerCase() === needle)) continue;
      const display = staffDisplayName(
        (row as { full_name?: string | null }).full_name,
        (row as { email?: string | null }).email,
      );
      if (display) names.add(display);
    }
  }

  return [...names];
}

export function reportCampersForBusRoster(
  bubbleCampers: BubbleSheetCamper[],
  children: TransportReportChildRow[],
  routeMeta: TransportRouteMeta[],
  coreStops: Record<number, TransportRouteStop[]>,
  parentTransportCampers: ParentTransportCamper[],
  schedules: CamperBusRunSchedules,
  busLabel: string,
): GroupReportCamper[] {
  return bubbleCampers.map((bc) => {
    const child = children.find((c) => c.name.trim().toLowerCase() === bc.name.trim().toLowerCase());
    if (!child) {
      return {
        name: bc.name,
        demographicsLine: "—",
        programLine: bc.detail ?? "—",
        transportLine: busLabel,
        contactsBlock: "—",
      };
    }
    return {
      ...childToGroupReportCamper(
        child,
        resolveCamperTransportLine(child.name, routeMeta, coreStops, parentTransportCampers, schedules),
      ),
      transportLine: "",
    };
  });
}

export async function loadBusCounselorForRoute(
  supabase: SupabaseClient,
  companyId: string,
  referenceSeason: string,
  busLabel: string,
): Promise<string | null> {
  const digits = busLabel.match(/\d+/);
  if (!digits) return null;
  const busNumber = Number(digits[0]);
  const assignments = await loadRouteReferenceAssignments(supabase, companyId, referenceSeason, {
    busNumber,
  });
  for (const row of assignments) {
    const counselor = (row.busCounselor ?? "").trim();
    if (counselor) return counselor;
  }
  return null;
}

export type RouteSummaryStopRow = {
  routeName: string;
  bus: string;
  stopNumber: number;
  stopName: string;
  address: string;
  pickupTime: string;
  passengers: number;
};

export function childToGroupReportCamper(
  child: TransportReportChildRow,
  transportLine: string,
): GroupReportCamper {
  const barcodeValue = encodeCamperBarcode(child.personId ?? child.id);
  return {
    name: child.name,
    demographicsLine: formatReportGenderAgeGrade(child),
    programLine: formatReportProgramLine(child),
    transportLine,
    contactsBlock: formatReportParentContacts(child),
    barcodeValue,
    addressLine: child.homeAddress?.trim() || undefined,
    divisionLine: child.divisionName?.trim() || undefined,
    town: townFromHomeAddress(child.homeAddress) || undefined,
    sessionLine: child.session?.trim() || undefined,
  };
}

export function sessionSummaryForCampers(children: { session: string | null }[]): string | null {
  const sessions = [...new Set(children.map((child) => child.session?.trim()).filter(Boolean))] as string[];
  if (!sessions.length) return null;
  if (sessions.length === 1) return sessions[0];
  return sessions.slice(0, 3).join(", ");
}

export function buildRouteSummaryRows(
  routes: { id: number; name: string; bus: string; counselorPickup?: TransportRouteMeta["counselorPickup"] }[],
  coreStops: Record<number, TransportRouteStop[]>,
  period: "am" | "pm" = "am",
): RouteSummaryStopRow[] {
  const rows: RouteSummaryStopRow[] = [];
  for (const route of routes) {
    const stops = withCounselorPickupStops(coreStops[route.id] ?? [], route.counselorPickup, period);
    stops.forEach((stop, index) => {
      rows.push({
        routeName: route.name,
        bus: route.bus,
        stopNumber: index + 1,
        stopName: stop.name,
        address: stop.address,
        pickupTime: stop.pickupTime,
        passengers: stop.passengers,
      });
    });
  }
  return rows;
}
