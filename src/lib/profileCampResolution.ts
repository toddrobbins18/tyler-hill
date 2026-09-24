import type { SupabaseClient } from "@supabase/supabase-js";

type EntityRow = {
  id: string;
  company_id: string;
  season: string;
  person_id: string | null;
  name: string;
};

export type ProfileCampResolution =
  | { kind: "ok"; recordId: string; name: string }
  | { kind: "redirect"; recordId: string; name: string }
  | { kind: "not_found"; name?: string };

async function fetchEntityRow(
  supabase: SupabaseClient,
  table: "staff" | "children",
  id: string,
): Promise<EntityRow | null> {
  const { data, error } = await supabase
    .from(table)
    .select("id, company_id, season, person_id, name")
    .eq("id", id)
    .maybeSingle();

  if (error || !data) return null;
  return data as EntityRow;
}

async function findEntityInCamp(
  supabase: SupabaseClient,
  table: "staff" | "children",
  personId: string,
  companyId: string,
  season: string,
): Promise<EntityRow | null> {
  const { data, error } = await supabase
    .from(table)
    .select("id, company_id, season, person_id, name")
    .eq("person_id", personId)
    .eq("company_id", companyId)
    .eq("season", season)
    .maybeSingle();

  if (error || !data) return null;
  return data as EntityRow;
}

export async function resolveProfileForCamp(
  supabase: SupabaseClient,
  table: "staff" | "children",
  urlEntityId: string,
  companyId: string,
  season: string,
): Promise<ProfileCampResolution> {
  const row = await fetchEntityRow(supabase, table, urlEntityId);
  if (!row) {
    return { kind: "not_found" };
  }

  if (row.company_id === companyId && row.season === season) {
    return { kind: "ok", recordId: row.id, name: row.name };
  }

  if (row.person_id) {
    const campRow = await findEntityInCamp(
      supabase,
      table,
      row.person_id,
      companyId,
      season,
    );
    if (campRow) {
      return { kind: "redirect", recordId: campRow.id, name: campRow.name };
    }
  }

  return { kind: "not_found", name: row.name };
}

export async function resolveStaffForCampView(
  supabase: SupabaseClient,
  urlStaffId: string,
  companyId: string,
  season: string,
): Promise<ProfileCampResolution> {
  return resolveProfileForCamp(supabase, "staff", urlStaffId, companyId, season);
}

export async function resolveChildForCampView(
  supabase: SupabaseClient,
  urlChildId: string,
  companyId: string,
  season: string,
): Promise<ProfileCampResolution> {
  return resolveProfileForCamp(supabase, "children", urlChildId, companyId, season);
}
