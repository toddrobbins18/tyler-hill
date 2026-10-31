import type { SupabaseClient } from "@supabase/supabase-js";
import { loadTransportRunBoard } from "@/lib/transportRunBoard";

/** Distinct bus labels on the run board for counselor assignment dropdowns. */
export async function loadTransportBusLabels(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  runDate: string,
): Promise<string[]> {
  const board = await loadTransportRunBoard(supabase, companyId, season, runDate);
  if (!board) return [];

  const labels = new Set<string>();
  for (const route of [...(board.amRoutes ?? []), ...(board.pmRoutes ?? [])]) {
    const bus = route.bus?.trim();
    if (bus) labels.add(bus);
  }

  return [...labels].sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}
