import { supabase } from "@/integrations/supabase/client";
import { filterActiveRoster } from "@/lib/rosterStatus";
import type { OptCamper } from "@/lib/bunking-optimizer";

type RosterChildRow = {
  id: string;
  name: string;
  gender: string | null;
  grade: string | null;
  group_name: string | null;
  category: string | null;
  status: string | null;
  division: { name: string } | null;
};

/** Load enrolled campers from Nest roster for bunking boards. */
export async function fetchBunkingCampersFromRoster(
  companyId: string,
  season: string,
): Promise<OptCamper[]> {
  const { data, error } = await supabase
    .from("children")
    .select(`
      id,
      name,
      gender,
      grade,
      group_name,
      category,
      status,
      division:division_id(name)
    `)
    .eq("company_id", companyId)
    .eq("season", season)
    .order("name");

  if (error) throw error;

  return filterActiveRoster(data as RosterChildRow[] | null).map((child) => ({
    id: child.id,
    name: child.name,
    gender: child.gender || undefined,
    division:
      child.division?.name?.trim() ||
      child.grade?.trim() ||
      child.group_name?.trim() ||
      child.category?.trim() ||
      "",
    town: "",
    requests: [],
    disrequests: [],
  }));
}
