import type { SupabaseClient } from "@supabase/supabase-js";

export type SportsAcademyChild = {
  id: string;
  name: string | null;
  age?: number | null;
  gender?: string | null;
  division_id?: string | null;
  division?: { id: string; name: string; gender?: string | null } | null;
};

export type SportsAcademyEnrollment = {
  id?: string;
  child_id: string;
  sport_name: string;
  child?: SportsAcademyChild | null;
  children?: SportsAcademyChild | null;
  [key: string]: unknown;
};

const CHILD_BATCH_SIZE = 500;

/** Prefer roster `name`; tolerate empty strings from imports. */
export function sportsAcademyCamperName(enrollment: SportsAcademyEnrollment): string {
  const child = enrollment.child ?? enrollment.children;
  const name = String(child?.name ?? "").trim();
  return name || "Unknown";
}

export function enrollmentMatchesSpecialistSports(
  enrollment: SportsAcademyEnrollment,
  assignedSports: string[] | null,
): boolean {
  if (!assignedSports || assignedSports.length === 0) return true;
  return assignedSports.includes(enrollment.sport_name);
}

/** Load camper rows separately so names resolve even when PostgREST embeds are blocked by RLS. */
export async function enrichSportsAcademyEnrollments(
  client: SupabaseClient,
  enrollments: SportsAcademyEnrollment[],
  companyId: string,
  season: string,
): Promise<SportsAcademyEnrollment[]> {
  if (enrollments.length === 0) return [];

  const childIds = Array.from(new Set(enrollments.map((e) => e.child_id).filter(Boolean)));
  const childMap = new Map<string, SportsAcademyChild>();

  for (let i = 0; i < childIds.length; i += CHILD_BATCH_SIZE) {
    const batch = childIds.slice(i, i + CHILD_BATCH_SIZE);
    const { data, error } = await client
      .from("children")
      .select("id, name, age, gender, division_id, division:divisions(id, name, gender)")
      .eq("company_id", companyId)
      .eq("season", season)
      .in("id", batch);

    if (error) throw error;
    (data || []).forEach((row) => {
      childMap.set(row.id, row as SportsAcademyChild);
    });
  }

  return enrollments.map((enrollment) => {
    const embedded = enrollment.child ?? enrollment.children;
    const embeddedName = String(embedded?.name ?? "").trim();
    const resolved = embeddedName ? embedded : childMap.get(enrollment.child_id) ?? embedded ?? null;
    return {
      ...enrollment,
      child: resolved,
      children: resolved,
    };
  });
}
