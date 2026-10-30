-- Division channel media posts (storage upload client-side, row insert via SECURITY DEFINER).

CREATE OR REPLACE FUNCTION public.post_division_channel_media(
  _root_id uuid,
  _content text,
  _message_id uuid,
  _message_kind text,
  _media_storage_path text,
  _media_mime text,
  _media_file_name text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  root public.messages%ROWTYPE;
  kind text := NULLIF(trim(coalesce(_message_kind, '')), '');
  path text := NULLIF(trim(coalesce(_media_storage_path, '')), '');
  body text := trim(coalesce(_content, ''));
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF _message_id IS NULL THEN RAISE EXCEPTION 'Missing message id'; END IF;
  IF path IS NULL OR kind IS NULL THEN RAISE EXCEPTION 'Missing media metadata'; END IF;
  IF kind NOT IN ('image', 'video', 'audio', 'file') THEN
    RAISE EXCEPTION 'Invalid message kind';
  END IF;

  SELECT * INTO root FROM public.messages m
  WHERE m.id = _root_id
    AND m.thread_kind = 'division_channel'
    AND m.parent_message_id IS NULL;

  IF root.id IS NULL OR NOT public.staff_can_access_division_messaging(uid, root.division_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  INSERT INTO public.messages (
    id,
    sender_id,
    recipient_id,
    subject,
    content,
    parent_message_id,
    notification_type,
    read,
    company_id,
    division_id,
    thread_kind,
    message_kind,
    media_storage_path,
    media_mime,
    media_file_name
  ) VALUES (
    _message_id,
    uid,
    NULL,
    'Re: ' || COALESCE(root.subject, 'Division channel'),
    body,
    _root_id,
    'message',
    false,
    root.company_id,
    root.division_id,
    'division_channel',
    kind,
    path,
    NULLIF(trim(coalesce(_media_mime, '')), ''),
    NULLIF(trim(coalesce(_media_file_name, '')), '')
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN _message_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.post_division_channel_media(uuid, text, uuid, text, text, text, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.user_can_access_message_media_path(_user_id uuid, _storage_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL
    AND _storage_path IS NOT NULL
    AND length(trim(_storage_path)) > 0
    AND (
      EXISTS (
        SELECT 1
        FROM public.messages m
        WHERE m.media_storage_path = _storage_path
          AND (_user_id = m.sender_id OR _user_id = m.recipient_id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.messages m
        WHERE m.media_storage_path = _storage_path
          AND m.thread_kind = 'division_channel'
          AND m.division_id IS NOT NULL
          AND public.staff_can_access_division_messaging(_user_id, m.division_id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.group_messages gm
        JOIN public.message_group_members mgm
          ON mgm.group_id = gm.group_id
         AND mgm.user_id = _user_id
        WHERE gm.media_storage_path = _storage_path
      )
      OR public.user_can_access_message_media(
        _user_id,
        (split_part(_storage_path, '/', 1))::uuid
      )
      OR EXISTS (
        SELECT 1
        FROM public.families f
        WHERE f.user_id = _user_id
          AND f.company_id = (split_part(_storage_path, '/', 1))::uuid
      )
    );
$$;

NOTIFY pgrst, 'reload schema';
