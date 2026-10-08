import type { SupabaseClient } from "@supabase/supabase-js";
import { isNestSandboxCompany } from "@/lib/camps";

export const MESSAGE_MEDIA_BUCKET = "message-media";

/** No app-side cap — size is enforced by Supabase Storage (project global + bucket settings). */
export const MAX_MESSAGE_IMAGE_BYTES: number | null = null;
export const MAX_MESSAGE_VIDEO_BYTES: number | null = null;

export const MESSAGE_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const;

export const MESSAGE_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
] as const;

export type MessageKind = "text" | "image" | "video";

export type MessageMediaFields = {
  message_kind: MessageKind;
  media_storage_path: string | null;
  media_mime: string | null;
  media_file_name: string | null;
};

export function messageMediaEnabledForCamp(slug: string | null | undefined): boolean {
  return isNestSandboxCompany(slug);
}

export function classifyMessageMediaFile(file: File): MessageKind | null {
  if (MESSAGE_IMAGE_MIME_TYPES.includes(file.type as (typeof MESSAGE_IMAGE_MIME_TYPES)[number])) {
    return "image";
  }
  if (MESSAGE_VIDEO_MIME_TYPES.includes(file.type as (typeof MESSAGE_VIDEO_MIME_TYPES)[number])) {
    return "video";
  }
  return null;
}

export function validateMessageMediaFile(file: File): { ok: true; kind: MessageKind } | { ok: false; error: string } {
  const kind = classifyMessageMediaFile(file);
  if (!kind) {
    return { ok: false, error: "This file type is not supported." };
  }
  const max = kind === "image" ? MAX_MESSAGE_IMAGE_BYTES : MAX_MESSAGE_VIDEO_BYTES;
  if (max != null && file.size > max) {
    return {
      ok: false,
      error:
        kind === "video"
          ? "This video is too large. Please choose a smaller video."
          : "This image is too large. Please choose a smaller photo.",
    };
  }
  return { ok: true, kind };
}

export function buildMessageMediaStoragePath(options: {
  companyId: string;
  scope: "direct" | "group";
  scopeId: string;
  messageId: string;
  fileName: string;
}): string {
  const safeName = options.fileName.replace(/[^\w.\-()+]/g, "_");
  return `${options.companyId}/${options.scope}/${options.scopeId}/${options.messageId}/${safeName}`;
}

export async function uploadMessageMediaFile(
  supabase: SupabaseClient,
  path: string,
  file: File,
  onProgress?: (pct: number) => void,
): Promise<{ error: string | null }> {
  onProgress?.(5);
  const { error } = await supabase.storage.from(MESSAGE_MEDIA_BUCKET).upload(path, file, {
    cacheControl: "3600",
    upsert: false,
    contentType: file.type,
  });
  onProgress?.(100);
  if (error) {
    console.error("[messageMedia] upload failed:", error.message);
    return { error: "Media upload failed. Please try again." };
  }
  return { error: null };
}

export async function createSignedMessageMediaUrl(
  supabase: SupabaseClient,
  storagePath: string,
): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(MESSAGE_MEDIA_BUCKET)
    .createSignedUrl(storagePath, 60 * 60);
  if (error || !data?.signedUrl) {
    console.warn("[messageMedia] signed URL failed:", error?.message);
    return null;
  }
  return data.signedUrl;
}

export function messagePreviewLabel(kind: MessageKind | string | null | undefined, content: string): string {
  if (kind === "image") return content.trim() ? content.trim() : "Photo";
  if (kind === "video") return content.trim() ? content.trim() : "Video";
  return content;
}

export async function sendDirectMessageMedia(
  supabase: SupabaseClient,
  options: {
    companyId: string;
    senderId: string;
    recipientId: string | null;
    subject: string;
    parentMessageId?: string | null;
    threadScopeId: string;
    caption: string;
    file: File;
    senderDisplayName?: string | null;
    notificationType?: string;
    onProgress?: (pct: number) => void;
  },
): Promise<{ error: string | null }> {
  const validation = validateMessageMediaFile(options.file);
  if (!validation.ok) return { error: validation.error };

  const messageId = crypto.randomUUID();
  const storagePath = buildMessageMediaStoragePath({
    companyId: options.companyId,
    scope: "direct",
    scopeId: options.threadScopeId,
    messageId,
    fileName: options.file.name,
  });

  const upload = await uploadMessageMediaFile(supabase, storagePath, options.file, options.onProgress);
  if (upload.error) return upload;

  const { error } = await supabase.from("messages").insert({
    id: messageId,
    company_id: options.companyId,
    sender_id: options.senderId,
    recipient_id: options.recipientId,
    subject: options.subject,
    content: options.caption.trim(),
    parent_message_id: options.parentMessageId ?? null,
    notification_type: options.notificationType ?? "message",
    read: false,
    sender_display_name: options.senderDisplayName ?? null,
    message_kind: validation.kind,
    media_storage_path: storagePath,
    media_mime: options.file.type,
    media_file_name: options.file.name,
  });

  if (error) {
    console.error("[messageMedia] direct insert failed:", error.message);
    await supabase.storage.from(MESSAGE_MEDIA_BUCKET).remove([storagePath]);
    return { error: "Could not send media message. Please try again." };
  }

  return { error: null };
}

export async function sendGroupMessageMedia(
  supabase: SupabaseClient,
  options: {
    companyId: string;
    groupId: string;
    senderId: string;
    parentMessageId?: string | null;
    caption: string;
    file: File;
    onProgress?: (pct: number) => void;
  },
): Promise<{ error: string | null; preview: string }> {
  const validation = validateMessageMediaFile(options.file);
  if (!validation.ok) return { error: validation.error, preview: "" };

  const messageId = crypto.randomUUID();
  const storagePath = buildMessageMediaStoragePath({
    companyId: options.companyId,
    scope: "group",
    scopeId: options.groupId,
    messageId,
    fileName: options.file.name,
  });

  const upload = await uploadMessageMediaFile(supabase, storagePath, options.file, options.onProgress);
  if (upload.error) return { error: upload.error, preview: "" };

  const caption = options.caption.trim();
  const { error } = await supabase.from("group_messages").insert({
    id: messageId,
    group_id: options.groupId,
    sender_id: options.senderId,
    content: caption,
    parent_message_id: options.parentMessageId ?? null,
    message_kind: validation.kind,
    media_storage_path: storagePath,
    media_mime: options.file.type,
    media_file_name: options.file.name,
  });

  if (error) {
    console.error("[messageMedia] group insert failed:", error.message);
    await supabase.storage.from(MESSAGE_MEDIA_BUCKET).remove([storagePath]);
    return { error: "Could not send media message. Please try again.", preview: "" };
  }

  const preview = messagePreviewLabel(validation.kind, caption);
  return { error: null, preview };
}
