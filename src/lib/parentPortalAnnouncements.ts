import type { SupabaseClient } from "@supabase/supabase-js";
import type { CampAnnouncementContent } from "@/components/parentPortal/CampAnnouncement";
import { fetchPublishedCampUpdate } from "@/lib/parentPortalCampUpdates";
import {
  MESSAGE_MEDIA_BUCKET,
  uploadMessageMediaFile,
  validateMessageMediaFile,
  createSignedMessageMediaUrl,
} from "@/lib/messageMedia";

export type ParentPortalAnnouncement = {
  id: string;
  company_id: string;
  season: string;
  title: string;
  body: string;
  is_published: boolean;
  published_at: string;
  created_at: string;
  media_storage_path?: string | null;
  media_mime?: string | null;
  media_file_name?: string | null;
};

function buildAnnouncementMediaPath(companyId: string, announcementId: string, fileName: string): string {
  const safeName = fileName.replace(/[^\w.\-()+]/g, "_");
  return `${companyId}/announcements/${announcementId}/${safeName}`;
}

export async function notifyCompanyExpoPush(
  supabase: SupabaseClient,
  options: {
    companyId: string;
    audience: "parents" | "staff" | "both";
    title: string;
    body: string;
    data?: Record<string, unknown>;
  },
): Promise<void> {
  try {
    await supabase.functions.invoke("notify-company-expo-push", {
      body: {
        company_id: options.companyId,
        audience: options.audience,
        title: options.title,
        body: options.body,
        data: options.data ?? {},
      },
    });
  } catch (e) {
    console.warn("[expo-push] invoke failed:", e);
  }
}

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
  options?: { imageFile?: File | null },
): Promise<{ id: string | null; error: string | null }> {
  const announcementId = crypto.randomUUID();
  let mediaPath: string | null = null;
  let mediaMime: string | null = null;
  let mediaFileName: string | null = null;

  if (options?.imageFile) {
    const validation = validateMessageMediaFile(options.imageFile);
    if (!validation.ok) return { id: null, error: validation.error };
    if (validation.kind !== "image") {
      return { id: null, error: "Announcements support photos only for now." };
    }
    mediaPath = buildAnnouncementMediaPath(companyId, announcementId, options.imageFile.name);
    const upload = await uploadMessageMediaFile(supabase, mediaPath, options.imageFile);
    if (upload.error) return { id: null, error: upload.error };
    mediaMime = options.imageFile.type;
    mediaFileName = options.imageFile.name;
  }

  const { data, error } = await supabase.rpc("publish_parent_portal_announcement", {
    _company_id: companyId,
    _season: season,
    _title: title,
    _body: body,
    _announcement_id: announcementId,
    _media_storage_path: mediaPath,
    _media_mime: mediaMime,
    _media_file_name: mediaFileName,
  });
  if (error) {
    if (mediaPath) {
      await supabase.storage.from(MESSAGE_MEDIA_BUCKET).remove([mediaPath]);
    }
    return { id: null, error: error.message };
  }

  const preview = body.trim() || (mediaPath ? "New camp photo" : "Camp announcement");
  void notifyCompanyExpoPush(supabase, {
    companyId,
    audience: "parents",
    title: title.trim() || "Camp announcement",
    body: preview,
    data: { kind: "announcement", announcementId },
  });

  return { id: data as string, error: null };
}

async function fetchLatestPublishedAnnouncement(
  supabase: SupabaseClient,
  companyId: string,
): Promise<(CampAnnouncementContent & { publishedAtMs: number }) | null> {
  const { data, error } = await supabase
    .from("parent_portal_announcements")
    .select("title, body, published_at, media_storage_path, media_mime")
    .eq("company_id", companyId)
    .eq("is_published", true)
    .order("published_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || (!data?.body?.trim() && !data?.media_storage_path)) return null;
  const publishedAt = data.published_at ?? null;
  let mediaImageUrl: string | null = null;
  if (data.media_storage_path) {
    mediaImageUrl = await createSignedMessageMediaUrl(supabase, data.media_storage_path);
  }
  return {
    title: data.title,
    body: data.body ?? "",
    publishedAt,
    mediaImageUrl,
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
