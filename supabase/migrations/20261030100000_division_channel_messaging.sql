-- Phase 5: Staff division channels (one thread per division, camp-scoped).

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS division_id uuid REFERENCES public.divisions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_division_channel
  ON public.messages (division_id, thread_kind)
  WHERE parent_message_id IS NULL AND thread_kind = 'division_channel';

CREATE OR REPLACE FUNCTION public.staff_can_access_division_messaging(_user_id uuid, _division_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL
    AND _division_id IS NOT NULL
    AND (
      public.is_super_admin(_user_id)
      OR _division_id = ANY(COALESCE(public.get_user_divisions(_user_id), ARRAY[]::uuid[]))
      OR EXISTS (
        SELECT 1
        FROM public.divisions d
        JOIN public.user_roles ur ON ur.company_id = d.company_id AND ur.user_id = _user_id
        WHERE d.id = _division_id
          AND ur.role = ANY(
            ARRAY['admin', 'staff', 'division_leader']::public.app_role[]
          )
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.staff_can_access_division_messaging(uuid, uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_or_create_division_channel_root(_division_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  div record;
  existing_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.staff_can_access_division_messaging(uid, _division_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  SELECT d.id, d.company_id, d.name INTO div
  FROM public.divisions d
  WHERE d.id = _division_id;

  IF div.id IS NULL THEN
    RAISE EXCEPTION 'Division not found';
  END IF;

  SELECT m.id INTO existing_id
  FROM public.messages m
  WHERE m.parent_message_id IS NULL
    AND m.thread_kind = 'division_channel'
    AND m.division_id = _division_id
  ORDER BY m.created_at ASC
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  INSERT INTO public.messages (
    sender_id,
    recipient_id,
    subject,
    content,
    parent_message_id,
    notification_type,
    read,
    company_id,
    division_id,
    thread_kind
  ) VALUES (
    uid,
    NULL,
    'Division: ' || COALESCE(div.name, 'channel'),
    'Division channel for ' || COALESCE(div.name, 'staff'),
    NULL,
    'message',
    true,
    div.company_id,
    _division_id,
    'division_channel'
  )
  RETURNING id INTO existing_id;

  RETURN existing_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_division_channel_root(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_staff_division_channels(_company_id uuid)
RETURNS TABLE (
  division_id uuid,
  division_name text,
  thread_root_id uuid,
  latest_preview text,
  latest_at timestamptz
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
  SELECT
    d.id,
    d.name,
    root.id,
    COALESCE(latest.content, root.content, '') AS preview,
    COALESCE(latest.created_at, root.created_at) AS at
  FROM public.divisions d
  LEFT JOIN LATERAL (
    SELECT m.id, m.content, m.created_at
    FROM public.messages m
    WHERE m.parent_message_id IS NULL
      AND m.thread_kind = 'division_channel'
      AND m.division_id = d.id
    ORDER BY m.created_at ASC
    LIMIT 1
  ) root ON true
  LEFT JOIN LATERAL (
    SELECT m.content, m.created_at
    FROM public.messages m
    WHERE m.parent_message_id = root.id
    ORDER BY m.created_at DESC
    LIMIT 1
  ) latest ON root.id IS NOT NULL
  WHERE d.company_id = _company_id
    AND d.is_active IS NOT FALSE
    AND public.staff_can_access_division_messaging(uid, d.id)
  ORDER BY d.sort_order NULLS LAST, d.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_staff_division_channels(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_division_channel_timeline(_root_id uuid)
RETURNS SETOF public.messages
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  div_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT m.division_id INTO div_id
  FROM public.messages m
  WHERE m.id = _root_id
    AND m.thread_kind = 'division_channel'
    AND m.parent_message_id IS NULL;

  IF div_id IS NULL OR NOT public.staff_can_access_division_messaging(uid, div_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT m.*
  FROM public.messages m
  WHERE m.id = _root_id OR m.parent_message_id = _root_id
  ORDER BY m.created_at ASC;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_division_channel_timeline(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.post_division_channel_message(_root_id uuid, _content text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  root public.messages%ROWTYPE;
  new_id uuid;
  body text := trim(coalesce(_content, ''));
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF body = '' THEN RAISE EXCEPTION 'Empty message'; END IF;

  SELECT * INTO root FROM public.messages m
  WHERE m.id = _root_id
    AND m.thread_kind = 'division_channel'
    AND m.parent_message_id IS NULL;

  IF root.id IS NULL OR NOT public.staff_can_access_division_messaging(uid, root.division_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  INSERT INTO public.messages (
    sender_id,
    recipient_id,
    subject,
    content,
    parent_message_id,
    notification_type,
    read,
    company_id,
    division_id,
    thread_kind
  ) VALUES (
    uid,
    NULL,
    'Re: ' || COALESCE(root.subject, 'Division channel'),
    body,
    _root_id,
    'message',
    false,
    root.company_id,
    root.division_id,
    'division_channel'
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_division_channel_message(uuid, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
