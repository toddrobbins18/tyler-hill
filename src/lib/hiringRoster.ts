import { supabase } from "@/integrations/supabase/client";
import type { HiringStatus, StaffMember } from "@/types/staff";

type StaffRow = {
  id: string;
  name: string;
  role: string;
  department: string | null;
  status: string | null;
  staff_type: string | null;
};

/** CampMinder / Nest: active (or empty) staff are current hired staff for the season. */
export function isHiredStaffStatus(status: unknown): boolean {
  if (status == null) return true;
  const s = String(status).trim().toLowerCase();
  if (!s) return true;
  return !["inactive", "resigned", "dismissed", "cancelled", "terminated"].includes(s);
}

function mapStaffRow(row: StaffRow): StaffMember {
  return {
    id: row.id,
    name: row.name,
    position: row.role?.trim() || row.staff_type?.trim() || "Staff",
    department: (row.department?.trim() || "General").toUpperCase(),
    actualBudget: 0,
    proposedBudget: 0,
    kidCredit: 0,
    netBudget: 0,
    status: "hired",
  };
}

/** Active/hired staff for the selected camp season (CampMinder roster). */
export async function fetchHiredStaffForHiring(
  companyId: string,
  season: string,
): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from("staff")
    .select("id, name, role, department, status, staff_type")
    .eq("company_id", companyId)
    .eq("season", season)
    .order("name");

  if (error) throw error;

  return (data as StaffRow[] | null || [])
    .filter((row) => isHiredStaffStatus(row.status))
    .map(mapStaffRow);
}

/** Keep kanban edits (status, budgets, notes) for staff still on the roster. */
export function mergeHiringPipelineWithSaved(
  roster: StaffMember[],
  saved: StaffMember[] | null | undefined,
): StaffMember[] {
  if (!saved?.length) return roster;
  const savedById = new Map(saved.map((s) => [s.id, s]));
  return roster.map((member) => {
    const prev = savedById.get(member.id);
    if (!prev) return member;
    return {
      ...member,
      status: prev.status,
      actualBudget: prev.actualBudget,
      proposedBudget: prev.proposedBudget,
      kidCredit: prev.kidCredit,
      netBudget: prev.netBudget,
      notes: prev.notes,
      position: prev.position || member.position,
      department: prev.department || member.department,
    };
  });
}

export function countHiredPipeline(staff: StaffMember[]): number {
  return staff.filter((s) => s.status === "hired").length;
}

export const HIRING_PIPELINE_STATUSES: HiringStatus[] = [
  "to-hire",
  "interviewing",
  "offered",
  "hired",
];
