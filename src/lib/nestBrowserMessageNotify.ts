import { supabase } from "@/integrations/supabase/client";
import { messagePreviewLabel } from "@/lib/messageMedia";
import { toast } from "sonner";

let permissionRequested = false;

async function ensureBrowserNotificationPermission(): Promise<boolean> {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  if (!permissionRequested) {
    permissionRequested = true;
    const result = await Notification.requestPermission();
    return result === "granted";
  }
  return false;
}

type InsertRow = {
  id?: string;
  sender_id?: string | null;
  recipient_id?: string | null;
  parent_message_id?: string | null;
  thread_kind?: string | null;
  division_id?: string | null;
  subject?: string | null;
  content?: string | null;
  message_kind?: string | null;
  media_file_name?: string | null;
  read?: boolean;
};

/** Foreground / background tab alerts for Nest staff messaging (local browser notifications). */
export async function notifyNestStaffMessageInsert(row: InsertRow): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id || !row.id) return;
  const uid = user.id;
  if (row.sender_id === uid) return;

  const body = messagePreviewLabel(row.message_kind, String(row.content ?? ""), row.media_file_name);

  if (row.thread_kind === "division_channel" && row.parent_message_id && row.division_id) {
    const { data: allowed } = await supabase.rpc("staff_can_access_division_messaging", {
      _user_id: uid,
      _division_id: row.division_id,
    });
    if (!allowed) return;
    const title = "Division channel";
    if (document.hidden && (await ensureBrowserNotificationPermission())) {
      new Notification(title, { body });
    } else {
      toast.message(title, { description: body });
    }
    return;
  }

  if (row.thread_kind === "parent_division_leader") {
    const recipientId = row.recipient_id;
    if (recipientId !== uid || row.read) return;
    const title = String(row.subject || "Parent portal message");
    if (document.hidden && (await ensureBrowserNotificationPermission())) {
      new Notification(title, { body });
    } else {
      toast.message(title, { description: body });
    }
    return;
  }

  if (row.recipient_id !== uid || row.read) return;
  const title = String(row.subject || "New message");
  if (document.hidden && (await ensureBrowserNotificationPermission())) {
    new Notification(title, { body });
  } else {
    toast.message(title, { description: body });
  }
}
