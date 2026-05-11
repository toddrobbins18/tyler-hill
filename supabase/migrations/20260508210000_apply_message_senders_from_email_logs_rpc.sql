-- Auto-repair inbox rows missing sender_id by matching Nest bulk-send rows in email_logs.
-- Called by mobile (and optionally web) before loading messages so UI shows the real sender without manual SQL.

CREATE OR REPLACE FUNCTION public.apply_message_senders_from_email_logs_for_inbox()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  n integer;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

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
      ON TRIM(el.subject) = TRIM(m2.subject)
      AND m2.recipient_id = ANY (COALESCE(el.recipient_ids, ARRAY[]::uuid[]))
      AND m2.sender_id IS NULL
      AND m2.parent_message_id IS NULL
      AND el.sent_by IS NOT NULL
      AND m2.created_at >= el.sent_at - interval '15 minutes'
      AND m2.created_at <= el.sent_at + interval '15 minutes'
    INNER JOIN public.profiles AS p ON p.id = el.sent_by
    WHERE m2.recipient_id = auth.uid()
    ORDER BY m2.id, el.sent_at DESC
  ) AS sub
  WHERE m.id = sub.mid
    AND m.sender_id IS NULL
    AND m.recipient_id = auth.uid();

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;

REVOKE ALL ON FUNCTION public.apply_message_senders_from_email_logs_for_inbox() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.apply_message_senders_from_email_logs_for_inbox() TO authenticated;

COMMENT ON FUNCTION public.apply_message_senders_from_email_logs_for_inbox()
  IS 'Sets sender_id and sender_display_name on current user inbox roots using email_logs (bulk compose).';
