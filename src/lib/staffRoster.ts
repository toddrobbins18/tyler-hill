import { supabase } from "@/integrations/supabase/client";
import { ROSTER_PAGE_SIZE } from "@/lib/rosterChildren";

/** Paginated active staff fetch — Supabase defaults to 100 rows without .range(). */
export async function fetchStaffRoster(companyId: string, season: string) {
  const rows: Record<string, unknown>[] = [];
  let from = 0;

  for (;;) {
    const to = from + ROSTER_PAGE_SIZE - 1;
    const { data, error } = await supabase
      .from("staff")
      .select("*")
      .eq("company_id", companyId)
      .eq("season", season)
      .or("status.eq.active,status.is.null,status.eq.Active")
      .neq("name", "Unknown")
      .not("name", "is", null)
      .order("name")
      .range(from, to);

    if (error) throw error;

    const batch = data ?? [];
    rows.push(...batch);
    if (batch.length < ROSTER_PAGE_SIZE) break;
    from += ROSTER_PAGE_SIZE;
  }

  return rows.filter(
    (member) => String(member.status ?? "active").toLowerCase() !== "inactive",
  );
}
