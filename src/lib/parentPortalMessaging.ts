import type { SupabaseClient } from "@supabase/supabase-js";

export type ParentPortalThreadRow = {
  child_id: string;
  child_name: string;
  group_name: string | null;
  division_leader_user_id: string | null;
  division_leader_name: string | null;
  thread_root_id: string | null;
  latest_preview: string | null;
  latest_at: string | null;
};

export async function listParentPortalThreads(
  supabase: SupabaseClient,
  companyId: string,
): Promise<{ rows: ParentPortalThreadRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc("list_parent_portal_message_threads", {
    _company_id: companyId,
  });
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as ParentPortalThreadRow[], error: null };
}

export async function openParentDivisionLeaderThread(
  supabase: SupabaseClient,
  childId: string,
): Promise<{ threadRootId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc("get_or_create_parent_division_leader_thread", {
    _child_id: childId,
  });
  if (error) return { threadRootId: null, error: error.message };
  return { threadRootId: data as string, error: null };
}

export async function fetchMessageRootById(
  supabase: SupabaseClient,
  messageId: string,
): Promise<{ message: Record<string, unknown> | null; error: string | null }> {
  const { data, error } = await supabase.from("messages").select("*").eq("id", messageId).maybeSingle();
  if (error) return { message: null, error: error.message };
  return { message: data as Record<string, unknown> | null, error: null };
}

export type ParentPortalMediaRow = {
  message_id: string;
  thread_root_id: string;
  child_id: string | null;
  child_name: string | null;
  sender_id: string | null;
  message_kind: string | null;
  media_storage_path: string | null;
  media_mime: string | null;
  media_file_name: string | null;
  content: string | null;
  created_at: string;
};

export async function listParentPortalMedia(
  supabase: SupabaseClient,
  companyId: string,
): Promise<{ rows: ParentPortalMediaRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc("list_parent_portal_media", {
    _company_id: companyId,
  });
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as ParentPortalMediaRow[], error: null };
}

export type StaffParentPortalThreadRow = {
  thread_root_id: string;
  child_id: string | null;
  child_name: string | null;
  family_id: string | null;
  parent_user_id: string | null;
  parent_display_name: string | null;
  subject: string | null;
  latest_preview: string | null;
  latest_at: string | null;
  unread_for_staff: number;
};

export async function listStaffParentPortalInbox(
  supabase: SupabaseClient,
  companyId: string,
): Promise<{ rows: StaffParentPortalThreadRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc("list_staff_parent_portal_inbox", {
    _company_id: companyId,
  });
  if (error) return { rows: [], error: error.message };
  return { rows: (data ?? []) as StaffParentPortalThreadRow[], error: null };
}

export const PARENT_DIVISION_LEADER_THREAD_KIND = "parent_division_leader";
