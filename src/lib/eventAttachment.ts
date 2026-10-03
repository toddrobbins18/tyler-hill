import type { SupabaseClient } from "@supabase/supabase-js";

export const EVENT_ATTACHMENT_BUCKET = "rainy-day-documents";

export type EventAttachmentKind = "image" | "pdf" | "other";

export function eventAttachmentKind(
  fileName?: string | null,
  fileUrl?: string | null,
): EventAttachmentKind {
  const hint = (fileName || fileUrl || "").toLowerCase();
  if (/\.(png|jpe?g|gif|webp)$/i.test(hint)) return "image";
  if (/\.pdf$/i.test(hint)) return "pdf";
  return "other";
}

export function pathFromEventAttachmentUrl(fileUrl: string): string | null {
  const prefix = `/${EVENT_ATTACHMENT_BUCKET}/`;
  const i = fileUrl.indexOf(prefix);
  if (i === -1) return null;
  const after = fileUrl.slice(i + prefix.length);
  const q = after.indexOf("?");
  return q === -1 ? decodeURIComponent(after) : decodeURIComponent(after.slice(0, q));
}

export async function resolveEventAttachmentUrl(
  supabase: SupabaseClient,
  fileUrl: string,
  expiresIn = 3600,
): Promise<string> {
  const path = pathFromEventAttachmentUrl(fileUrl);
  if (!path) return fileUrl;

  const { data, error } = await supabase.storage
    .from(EVENT_ATTACHMENT_BUCKET)
    .createSignedUrl(path, expiresIn);

  if (error) return fileUrl;
  return data?.signedUrl || fileUrl;
}
