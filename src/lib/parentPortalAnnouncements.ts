import type { SupabaseClient } from "@supabase/supabase-js";
import type { CampAnnouncementContent } from "@/components/parentPortal/CampAnnouncement";
import { fetchPublishedCampUpdate } from "@/lib/parentPortalCampUpdates";

export type ParentPortalAnnouncement = {
  id: string;
  company_id: string;
  season: string;
  title: string;
  body: string;
  is_published: boolean;
  published_at: string;
  created_at: string;
};

export async function listStaffParentPortalAnnouncements(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
): Promise<{ rows: ParentPortalAnnouncement[]; error: string | null }> {
  const { data, error } = await supabase.rpc("list_staff_parent_portal_announcements", {
    _company_id: companyId,
    _season: season,
  });
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as ParentPortalAnnouncement[], error: null };
}

export async function publishParentPortalAnnouncement(
  supabase: SupabaseClient,
  companyId: string,
  season: string,
  title: string,
  body: string,
): Promise<{ id: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("publish_parent_portal_announcement", {
    _company_id: companyId,
    _season: season,
    _title: title,
    _body: body,
  });
  if (error) return { id: null, error: error.message };
  return { id: data as string, error: null };
}

async function fetchLatestPublishedAnnouncement(
  supabase: SupabaseClient,
  companyId: string,
): Promise<(CampAnnouncementContent & { publishedAtMs: number }) | null> {
  const { data, error } = await supabase
    .from("parent_portal_announcements")
    .select("title, body, published_at")
    .eq("company_id", companyId)
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.body?.trim()) return null;
  const publishedAt = data.published_at ?? null;
  return {
    title: data.title,
    body: data.body,
    publishedAt,
    publishedAtMs: publishedAt ? new Date(publishedAt).getTime() : 0,
  };
}

/** Parent home hero: newest published bulletin vs legacy season camp update. */
export async function fetchLatestParentPortalHomeBulletin(
  supabase: SupabaseClient,
  companyId: string,
): Promise<CampAnnouncementContent | null> {
  const [announcement, campUpdate] = await Promise.all([
    fetchLatestPublishedAnnouncement(supabase, companyId),
    fetchPublishedCampUpdate(supabase, companyId),
  ]);

  const campMs = campUpdate?.published_at ? new Date(campUpdate.published_at).getTime() : 0;
  const campContent: (CampAnnouncementContent & { publishedAtMs: number }) | null = campUpdate?.body?.trim()
    ? {
        title: campUpdate.title,
        body: campUpdate.body,
        publishedAt: campUpdate.published_at,
        publishedAtMs: campMs,
      }
    : null;

  if (announcement && campContent) {
    return announcement.publishedAtMs >= campContent.publishedAtMs
      ? announcement
      : campContent;
  }
  return announcement ?? campContent;
}
