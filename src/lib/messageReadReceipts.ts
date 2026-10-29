import type { SupabaseClient } from "@supabase/supabase-js";
import { format, isToday, isYesterday } from "date-fns";

export type ReadReceiptFields = {
  read?: boolean | null;
  read_at?: string | null;
};

/** Receipt for sent list rows: latest outbound reply in thread, else the root message. */
export function readReceiptForSentThread(
  root: ReadReceiptFields,
  replies: ReadReceiptFields[],
  senderUserId: string,
  replySenderIds?: (string | null | undefined)[],
): ReadReceiptFields {
  for (let i = replies.length - 1; i >= 0; i--) {
    const sid = replySenderIds?.[i];
    if (sid === senderUserId) {
      return { read: replies[i].read === true, read_at: replies[i].read_at ?? null };
    }
  }
  return { read: root.read === true, read_at: root.read_at ?? null };
}

export function mergeMessageRead<T extends ReadReceiptFields>(
  row: T,
  patch?: ReadReceiptFields | null,
): T {
  if (!patch) return row;
  const read = row.read === true || patch.read === true;
  const read_at = read ? row.read_at ?? patch.read_at ?? null : null;
  return { ...row, read, read_at };
}

export function formatReadReceiptTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  if (isToday(d)) return format(d, "h:mm a");
  if (isYesterday(d)) return `Yesterday ${format(d, "h:mm a")}`;
  return format(d, "MMM d, h:mm a");
}

/** Label for messages the current user sent (recipient read state). */
export function getReadReceiptLabel(
  message: ReadReceiptFields,
  options?: { includeDelivered?: boolean },
): string | null {
  const includeDelivered = options?.includeDelivered !== false;
  if (message.read === true) {
    const when = formatReadReceiptTime(message.read_at);
    return when ? `Read ${when}` : "Read";
  }
  if (includeDelivered) return "Delivered";
  return null;
}

export async function markMessageRead(
  supabase: SupabaseClient,
  messageId: string,
): Promise<{ error: string | null }> {
  const readAt = new Date().toISOString();
  const { error } = await supabase
    .from("messages")
    .update({ read: true, read_at: readAt })
    .eq("id", messageId)
    .eq("read", false);

  if (error) return { error: error.message };
  return { error: null };
}

/** Mark all thread replies addressed to this user as read when they open the thread. */
export async function markThreadRepliesReadForRecipient(
  supabase: SupabaseClient,
  parentMessageId: string,
  recipientUserId: string,
): Promise<void> {
  const readAt = new Date().toISOString();
  await supabase
    .from("messages")
    .update({ read: true, read_at: readAt })
    .eq("parent_message_id", parentMessageId)
    .eq("recipient_id", recipientUserId)
    .eq("read", false);
}
