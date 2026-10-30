/** Resolve the other party in a DM / parent-portal thread for replies. */
export function resolveThreadRecipientId(
  root: { sender_id?: string | null; recipient_id?: string | null },
  currentUserId: string,
  replies: { sender_id?: string | null }[] = [],
): string | null {
  if (root.sender_id === currentUserId && root.recipient_id) {
    return root.recipient_id;
  }
  if (root.recipient_id === currentUserId && root.sender_id) {
    return root.sender_id;
  }
  const fromReply = [...replies]
    .reverse()
    .find((r) => r.sender_id && r.sender_id !== currentUserId);
  if (fromReply?.sender_id) return fromReply.sender_id;
  if (root.recipient_id && root.recipient_id !== currentUserId) return root.recipient_id;
  if (root.sender_id && root.sender_id !== currentUserId) return root.sender_id;
  return null;
}
