export type SupervisorCandidate = {
  id: string;
  name: string;
  role: string | null;
  staff_type?: string | null;
};

/** Matches camp leadership titles (Tyler Hill uses many variants, not just "Director"). */
const SUPERVISOR_ROLE_PATTERN =
  /division leader|director|supervisor|manager|group leader|lead counselor|head specialist|head counselor|unit leader|asst\.|assistant |associate director|program director|\blead\b/i;

export function isEligibleSupervisor(
  staff: Pick<SupervisorCandidate, "role" | "staff_type">,
): boolean {
  if (staff.staff_type === "leadership") return true;

  const role = staff.role?.trim() || "";
  if (!role) return false;

  return SUPERVISOR_ROLE_PATTERN.test(role);
}

export function filterSupervisorCandidates(
  staff: SupervisorCandidate[],
  options?: { excludeStaffId?: string; includeStaffIds?: string[] },
): SupervisorCandidate[] {
  const includeIds = new Set((options?.includeStaffIds || []).filter(Boolean));

  return staff
    .filter((member) => {
      if (options?.excludeStaffId && member.id === options.excludeStaffId) return false;
      if (includeIds.has(member.id)) return true;
      return isEligibleSupervisor(member);
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function formatSupervisorOptionLabel(member: Pick<SupervisorCandidate, "name" | "role">): string {
  return member.role ? `${member.name} - ${member.role}` : member.name;
}
