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

/** Active hired staff for the season — same rules as the Staff roster page. */
export function isActiveHiredStaffRow(row: {
  status?: unknown;
  name?: unknown;
}): boolean {
  const name = String(row.name ?? "").trim();
  if (!name || name.toLowerCase() === "unknown") return false;
  const s = String(row.status ?? "active").trim().toLowerCase();
  if (!s) return true;
  return s === "active" || s !== "inactive";
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

/** Active hired staff for the selected camp + season (e.g. 2027). */
export async function fetchHiredStaffForHiring(
  companyId: string,
  season: string,
): Promise<StaffMember[]> {
  const { data, error } = await supabase
    .from("staff")
    .select("id, name, role, department, status, staff_type")
    .eq("company_id", companyId)
    .eq("season", season)
    .or("status.eq.active,status.is.null,status.eq.Active")
    .neq("name", "Unknown")
    .not("name", "is", null)
    .order("name");

  if (error) throw error;

  return (data as StaffRow[] | null || [])
    .filter(isActiveHiredStaffRow)
    .map(mapStaffRow);
}

/** Keep local budget/notes edits; roster is always hired for this season. */
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
      status: "hired" as HiringStatus,
      actualBudget: prev.actualBudget ?? member.actualBudget,
      proposedBudget: prev.proposedBudget ?? member.proposedBudget,
      kidCredit: prev.kidCredit ?? member.kidCredit,
      netBudget: prev.netBudget ?? member.netBudget,
      notes: prev.notes ?? member.notes,
    };
  });
}

export function countHiredPipeline(staff: StaffMember[]): number {
  return staff.length;
}

export const HIRING_PIPELINE_STATUSES: HiringStatus[] = ["hired"];
