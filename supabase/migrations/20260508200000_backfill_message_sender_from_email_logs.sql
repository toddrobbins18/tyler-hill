-- Repair inbox rows where the Edge Function omitted sender_id but email_logs captured the bulk send.
-- Safe to run more than once (only updates rows that still have NULL sender_id).
UPDATE public.messages AS m
SET
  sender_id = sub.sent_by,
  sender_display_name = sub.dname
FROM (
  SELECT DISTINCT ON (m2.id)
    m2.id AS mid,
    el.sent_by,
    COALESCE(
      NULLIF(TRIM(p.full_name), ''),
      NULLIF(SPLIT_PART(p.email, '@', 1), ''),
      'Staff'
    ) AS dname
  FROM public.messages AS m2
  INNER JOIN public.email_logs AS el
    ON el.subject = m2.subject
    AND m2.recipient_id = ANY (COALESCE(el.recipient_ids, ARRAY[]::uuid[]))
    AND m2.sender_id IS NULL
    AND m2.parent_message_id IS NULL
    AND el.sent_by IS NOT NULL
    AND m2.created_at >= el.sent_at - interval '5 minutes'
    AND m2.created_at <= el.sent_at + interval '5 minutes'
  INNER JOIN public.profiles AS p
    ON p.id = el.sent_by
  ORDER BY m2.id, el.sent_at DESC
) AS sub
WHERE m.id = sub.mid
  AND m.sender_id IS NULL;
