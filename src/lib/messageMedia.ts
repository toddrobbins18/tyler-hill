import type { SupabaseClient } from "@supabase/supabase-js";

export const MESSAGE_MEDIA_BUCKET = "message-media";

/** No app-side cap — size is enforced by Supabase Storage (project global + bucket settings). */
export const MAX_MESSAGE_IMAGE_BYTES: number | null = null;
export const MAX_MESSAGE_VIDEO_BYTES: number | null = null;
export const MAX_MESSAGE_AUDIO_BYTES: number | null = null;
export const MAX_MESSAGE_FILE_BYTES: number | null = null;

export const MESSAGE_IMAGE_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/heic",
  "image/heif",
] as const;

export const MESSAGE_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-m4v",
] as const;

export const MESSAGE_AUDIO_MIME_TYPES = [
  "audio/mpeg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/wav",
  "audio/webm",
  "audio/ogg",
  "audio/aac",
] as const;

export const MESSAGE_FILE_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-powerpoint",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
  "text/csv",
  "application/zip",
  "application/x-zip-compressed",
] as const;

export type MessageKind = "text" | "image" | "video" | "audio" | "file";

export type MessageMediaFields = {
  message_kind: MessageKind;
  media_storage_path: string | null;
  media_mime: string | null;
  media_file_name: string | null;
};

export function messageMediaEnabledForCamp(_slug: string | null | undefined): boolean {
  return true;
}

const EXTENSION_KIND: { ext: string; kind: MessageKind }[] = [
  { ext: "jpg", kind: "image" },
  { ext: "jpeg", kind: "image" },
  { ext: "png", kind: "image" },
  { ext: "webp", kind: "image" },
  { ext: "gif", kind: "image" },
  { ext: "heic", kind: "image" },
  { ext: "heif", kind: "image" },
  { ext: "mp4", kind: "video" },
  { ext: "mov", kind: "video" },
  { ext: "webm", kind: "video" },
  { ext: "m4v", kind: "video" },
  { ext: "mp3", kind: "audio" },
  { ext: "m4a", kind: "audio" },
  { ext: "wav", kind: "audio" },
  { ext: "ogg", kind: "audio" },
  { ext: "aac", kind: "audio" },
  { ext: "pdf", kind: "file" },
  { ext: "doc", kind: "file" },
  { ext: "docx", kind: "file" },
  { ext: "xls", kind: "file" },
  { ext: "xlsx", kind: "file" },
  { ext: "ppt", kind: "file" },
  { ext: "pptx", kind: "file" },
  { ext: "txt", kind: "file" },
  { ext: "csv", kind: "file" },
  { ext: "zip", kind: "file" },
];

function kindFromFileName(fileName: string): MessageKind | null {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (!ext) return null;
  return EXTENSION_KIND.find((e) => e.ext === ext)?.kind ?? null;
}

export function classifyMessageMediaFile(file: File): MessageKind | null {
  const mime = file.type?.toLowerCase() ?? "";
  if (mime.startsWith("image/")) {
    if (MESSAGE_IMAGE_MIME_TYPES.includes(mime as (typeof MESSAGE_IMAGE_MIME_TYPES)[number])) {
      return "image";
    }
    return "image";
  }
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (MESSAGE_FILE_MIME_TYPES.includes(mime as (typeof MESSAGE_FILE_MIME_TYPES)[number])) {
    return "file";
  }
  return kindFromFileName(file.name);
}

function maxBytesForKind(kind: MessageKind): number | null {
  switch (kind) {
    case "image":
      return MAX_MESSAGE_IMAGE_BYTES;
    case "video":
      return MAX_MESSAGE_VIDEO_BYTES;
    case "audio":
      return MAX_MESSAGE_AUDIO_BYTES;
    case "file":
      return MAX_MESSAGE_FILE_BYTES;
    default:
      return null;
  }
}

export function validateMessageMediaFile(file: File): { ok: true; kind: MessageKind } | { ok: false; error: string } {
  const kind = classifyMessageMediaFile(file);
  if (!kind) {
    return {
      ok: false,
      error: "This file type is not supported. Try a photo, video, audio clip, or common document (PDF, Word, etc.).",
    };
  }
  const max = maxBytesForKind(kind);
  if (max != null && file.size > max) {
    return { ok: false, error: "This file is too large. Please choose a smaller file." };
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
    contentType: file.type || "application/octet-stream",
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

export function messagePreviewLabel(
  kind: MessageKind | string | null | undefined,
  content: string,
  fileName?: string | null,
): string {
  if (kind === "image") return content.trim() ? content.trim() : "Photo";
  if (kind === "video") return content.trim() ? content.trim() : "Video";
  if (kind === "audio") return content.trim() ? content.trim() : "Audio";
  if (kind === "file") {
    const name = fileName?.trim();
    if (content.trim()) return content.trim();
    return name || "Attachment";
  }
  return content;
}

export function defaultMediaMessageSubject(kind: MessageKind): string {
  switch (kind) {
    case "video":
      return "Video";
    case "audio":
      return "Audio";
    case "file":
      return "Attachment";
    case "image":
    default:
      return "Photo";
  }
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
    childId?: string | null;
    familyId?: string | null;
    threadKind?: string | null;
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
    ...(options.childId ? { child_id: options.childId } : {}),
    ...(options.familyId ? { family_id: options.familyId } : {}),
    ...(options.threadKind ? { thread_kind: options.threadKind } : {}),
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

  const preview = messagePreviewLabel(validation.kind, caption, options.file.name);
  return { error: null, preview };
}

export const MESSAGE_ATTACHMENT_ACCEPT = [
  ...MESSAGE_IMAGE_MIME_TYPES,
  ...MESSAGE_VIDEO_MIME_TYPES,
  ...MESSAGE_AUDIO_MIME_TYPES,
  ...MESSAGE_FILE_MIME_TYPES,
  "image/*",
  "video/*",
  "audio/*",
].join(",");
