import { supabase } from "@/integrations/supabase/client";

/** Same page size as Camper roster (`Roster.tsx`). */
export const ROSTER_PAGE_SIZE = 1000;

const ACTIVE_CHILDREN_SELECT = `
  id,
  name,
  gender,
  grade,
  group_name,
  status,
  division:division_id(name)
`;

export type ActiveRosterChildRow = {
  id: string;
  name: string;
  gender: string | null;
  grade: string | null;
  group_name: string | null;
  status: string | null;
  division: { name: string } | null;
};

/** Paginated active camper fetch — matches Camper roster query. */
export async function fetchActiveRosterChildren(
  companyId: string,
  season: string,
): Promise<ActiveRosterChildRow[]> {
  const rows: ActiveRosterChildRow[] = [];
  let from = 0;

  for (;;) {
    const to = from + ROSTER_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("children")
      .select(ACTIVE_CHILDREN_SELECT)
      .eq("company_id", companyId)
      .eq("season", season)
      .neq("status", "inactive")
      .order("name")
      .range(from, to);

    if (error) throw error;

    const batch = (data as ActiveRosterChildRow[] | null) ?? [];
    rows.push(...batch);
    if (batch.length < ROSTER_PAGE_SIZE) break;
    from += ROSTER_PAGE_SIZE;
  }

  return rows;
}
