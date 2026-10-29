-- Phase 2–3: Parent media gallery + staff parent-family inbox helpers.

CREATE OR REPLACE FUNCTION public.list_parent_portal_media(_company_id uuid)
RETURNS TABLE (
  message_id uuid,
  thread_root_id uuid,
  child_id uuid,
  child_name text,
  sender_id uuid,
  message_kind text,
  media_storage_path text,
  media_mime text,
  media_file_name text,
  content text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fam_id uuid;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;

  SELECT f.id INTO fam_id
  FROM public.families f
  WHERE f.user_id = uid AND f.company_id = _company_id
  LIMIT 1;

  IF fam_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH roots AS (
    SELECT m.id AS root_id, m.child_id
    FROM public.messages m
    WHERE m.parent_message_id IS NULL
      AND m.thread_kind = 'parent_division_leader'
      AND m.family_id = fam_id
      AND m.company_id = _company_id
  )
  SELECT
    msg.id,
    COALESCE(msg.parent_message_id, msg.id) AS thread_root_id,
    COALESCE(msg.child_id, r.child_id) AS child_id,
    c.name AS child_name,
    msg.sender_id,
    msg.message_kind,
    msg.media_storage_path,
    msg.media_mime,
    msg.media_file_name,
    msg.content,
    msg.created_at
  FROM public.messages msg
  LEFT JOIN roots r ON r.root_id = COALESCE(msg.parent_message_id, msg.id)
  LEFT JOIN public.children c ON c.id = COALESCE(msg.child_id, r.child_id)
  WHERE (
      msg.id IN (SELECT root_id FROM roots)
      OR msg.parent_message_id IN (SELECT root_id FROM roots)
    )
    AND (
      msg.media_storage_path IS NOT NULL
      OR COALESCE(msg.message_kind, 'text') IN ('image', 'video', 'audio', 'file')
    )
  ORDER BY msg.created_at DESC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_parent_portal_media(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_staff_parent_portal_inbox(_company_id uuid)
RETURNS TABLE (
  thread_root_id uuid,
  child_id uuid,
  child_name text,
  family_id uuid,
  parent_user_id uuid,
  parent_display_name text,
  subject text,
  latest_preview text,
  latest_at timestamptz,
  unread_for_staff bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;

  RETURN QUERY
  WITH roots AS (
    SELECT m.*
    FROM public.messages m
    WHERE m.company_id = _company_id
      AND m.parent_message_id IS NULL
      AND m.thread_kind = 'parent_division_leader'
      AND (m.sender_id = uid OR m.recipient_id = uid)
  ),
  latest AS (
    SELECT DISTINCT ON (r.id)
      r.id AS root_id,
      COALESCE(reply.content, r.content) AS preview,
      COALESCE(reply.created_at, r.created_at) AS at
    FROM roots r
    LEFT JOIN public.messages reply ON reply.parent_message_id = r.id
    ORDER BY r.id, reply.created_at DESC NULLS LAST
  ),
  unread AS (
    SELECT reply.parent_message_id AS root_id, COUNT(*)::bigint AS cnt
    FROM public.messages reply
    JOIN roots r ON r.id = reply.parent_message_id
    WHERE reply.recipient_id = uid
      AND COALESCE(reply.read, false) = false
    GROUP BY reply.parent_message_id
  )
  SELECT
    r.id,
    r.child_id,
    c.name,
    r.family_id,
    CASE WHEN r.sender_id = uid THEN r.recipient_id ELSE r.sender_id END AS parent_user_id,
    COALESCE(
      NULLIF(trim(p.full_name), ''),
      split_part(p.email, '@', 1),
      'Parent'
    ) AS parent_display_name,
    r.subject,
    l.preview,
    l.at,
    COALESCE(u.cnt, 0)
  FROM roots r
  LEFT JOIN public.children c ON c.id = r.child_id
  LEFT JOIN public.profiles p ON p.id = CASE WHEN r.sender_id = uid THEN r.recipient_id ELSE r.sender_id END
  LEFT JOIN latest l ON l.root_id = r.id
  LEFT JOIN unread u ON u.root_id = r.id
  ORDER BY l.at DESC NULLS LAST;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_staff_parent_portal_inbox(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
