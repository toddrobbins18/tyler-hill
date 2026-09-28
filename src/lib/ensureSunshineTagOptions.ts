import type { SupabaseClient } from "@supabase/supabase-js";
import type { SunshineTagSeed } from "@/lib/sunshineReportOptions";

export async function ensureSunshineTagOptions(
  supabase: SupabaseClient,
  companyId: string,
  seeds: readonly SunshineTagSeed[],
): Promise<number> {
  if (seeds.length === 0) return 0;

  const { data: existing, error: loadError } = await supabase
    .from("sunshine_tag_options")
    .select("category, label")
    .eq("company_id", companyId);

  if (loadError) throw loadError;

  const seen = new Set((existing ?? []).map((row) => `${row.category}:${row.label}`));
  const toInsert = seeds.filter((seed) => !seen.has(`${seed.category}:${seed.label}`));
  if (toInsert.length === 0) return 0;

  const { error } = await supabase.from("sunshine_tag_options").insert(
    toInsert.map((seed) => ({
      company_id: companyId,
      category: seed.category,
      label: seed.label,
      color: seed.color,
      sort_order: seed.sort_order,
    })),
  );

  if (error) throw error;
  return toInsert.length;
}
