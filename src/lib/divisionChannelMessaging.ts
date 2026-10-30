import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildMessageMediaStoragePath,
  MESSAGE_MEDIA_BUCKET,
  uploadMessageMediaFile,
  validateMessageMediaFile,
  type MessageKind,
} from "@/lib/messageMedia";

export const DIVISION_CHANNEL_THREAD_KIND = "division_channel";

export type DivisionChannelRow = {
  division_id: string;
  division_name: string;
  thread_root_id: string | null;
  latest_preview: string | null;
  latest_at: string | null;
  unread_for_staff?: number;
};

export async function listStaffDivisionChannels(
  supabase: SupabaseClient,
  companyId: string,
): Promise<{ rows: DivisionChannelRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc("list_staff_division_channels", {
    _company_id: companyId,
  });
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as DivisionChannelRow[], error: null };
}

export async function countStaffDivisionChannelUnread(
  supabase: SupabaseClient,
  companyId: string,
): Promise<{ total: number; error: string | null }> {
  const { data, error } = await supabase.rpc("count_staff_division_channel_unread", {
    _company_id: companyId,
  });
  if (error) return { total: 0, error: error.message };
  return { total: Number(data ?? 0), error: null };
}

export async function markDivisionChannelRead(
  supabase: SupabaseClient,
  rootId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc("mark_division_channel_read", { _root_id: rootId });
  if (error) return { error: error.message };
  return { error: null };
}

export async function openDivisionChannelRoot(
  supabase: SupabaseClient,
  divisionId: string,
): Promise<{ rootId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("get_or_create_division_channel_root", {
    _division_id: divisionId,
  });
  if (error) return { rootId: null, error: error.message };
  return { rootId: data as string, error: null };
}

export async function fetchDivisionChannelTimeline(
  supabase: SupabaseClient,
  rootId: string,
): Promise<{ rows: Record<string, unknown>[]; error: string | null }> {
  const { data, error } = await supabase.rpc("list_division_channel_timeline", {
    _root_id: rootId,
  });
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as Record<string, unknown>[], error: null };
}

export async function postDivisionChannelMessage(
  supabase: SupabaseClient,
  rootId: string,
  content: string,
): Promise<{ messageId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("post_division_channel_message", {
    _root_id: rootId,
    _content: content,
  });
  if (error) return { messageId: null, error: error.message };
  return { messageId: data as string, error: null };
}

export async function sendDivisionChannelMessageMedia(
  supabase: SupabaseClient,
  options: {
    rootId: string;
    companyId: string;
    caption: string;
    file: File;
    onProgress?: (pct: number) => void;
  },
): Promise<{ error: string | null }> {
  const validation = validateMessageMediaFile(options.file);
  if (!validation.ok) return { error: validation.error };

  const messageId = crypto.randomUUID();
  const storagePath = buildMessageMediaStoragePath({
    companyId: options.companyId,
    scope: "direct",
    scopeId: options.rootId,
    messageId,
    fileName: options.file.name,
  });

  const upload = await uploadMessageMediaFile(supabase, storagePath, options.file, options.onProgress);
  if (upload.error) return upload;

  const { error } = await supabase.rpc("post_division_channel_media", {
    _root_id: options.rootId,
    _content: options.caption.trim(),
    _message_id: messageId,
    _message_kind: validation.kind,
    _media_storage_path: storagePath,
    _media_mime: options.file.type || null,
    _media_file_name: options.file.name,
  });

  if (error) {
    await supabase.storage.from(MESSAGE_MEDIA_BUCKET).remove([storagePath]);
    return { error: error.message };
  }

  return { error: null };
}

export type DivisionChannelTimelineRow = {
  id: string;
  content: string;
  created_at: string;
  sender_id: string | null;
  parent_message_id: string | null;
  message_kind?: MessageKind | string | null;
  media_storage_path?: string | null;
  media_mime?: string | null;
  media_file_name?: string | null;
};
