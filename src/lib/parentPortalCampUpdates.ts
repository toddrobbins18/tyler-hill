import type { SupabaseClient } from "@supabase/supabase-js";

export type ParentPortalCampUpdate = {
  id: string;
  company_id: string;
  season: string;
  title: string;
  body: string;
  is_published: boolean;
  published_at: string | null;
  updated_at: string;
};

export type ParentPortalCampUpdateDraft = {
  title: string;
  body: string;
  is_published: boolean;
};

export async function fetchCampUpdateForSeason(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
): Promise<ParentPortalCampUpdate | null> {
  const { data, error } = await supabase
    .from("parent_portal_camp_updates")
    .select("id, company_id, season, title, body, is_published, published_at, updated_at")
    .eq("company_id", companyId)
    .eq("season", season)
    .maybeSingle();

  if (error) throw error;
  return data as ParentPortalCampUpdate | null;
}

/** Latest published bulletin for a company (parent portal home). */
export async function fetchPublishedCampUpdate(
  supabase: SupabaseClient,
  companyId: string,
): Promise<Pick<ParentPortalCampUpdate, "title" | "body" | "published_at" | "season"> | null> {
  const { data, error } = await supabase
    .from("parent_portal_camp_updates")
    .select("title, body, published_at, season")
    .eq("company_id", companyId)
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function saveCampUpdateForSeason(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  draft: ParentPortalCampUpdateDraft,
  userId: string | undefined,
): Promise<ParentPortalCampUpdate> {
  const existing = await fetchCampUpdateForSeason(supabase, companyId, season);
  const publishedAt = draft.is_published
    ? existing?.is_published
      ? existing.published_at ?? new Date().toISOString()
      : new Date().toISOString()
    : null;

  const payload = {
    company_id: companyId,
    season,
    title: draft.title.trim() || "Camp updates",
    body: draft.body.trim(),
    is_published: draft.is_published,
    published_at: publishedAt,
    updated_by: userId ?? null,
  };

  const { data, error } = existing
    ? await supabase
        .from("parent_portal_camp_updates")
        .update(payload)
        .eq("id", existing.id)
        .select("id, company_id, season, title, body, is_published, published_at, updated_at")
        .single()
    : await supabase
        .from("parent_portal_camp_updates")
        .insert(payload)
        .select("id, company_id, season, title, body, is_published, published_at, updated_at")
        .single();

  if (error) throw error;
  return data as ParentPortalCampUpdate;
}
