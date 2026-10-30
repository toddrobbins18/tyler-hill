-- Announcement hero images + Expo push token storage for remote mobile alerts.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS expo_push_token text,
  ADD COLUMN IF NOT EXISTS expo_push_updated_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_profiles_expo_push_token
  ON public.profiles (expo_push_token)
  WHERE expo_push_token IS NOT NULL;

ALTER TABLE public.parent_portal_announcements
  ADD COLUMN IF NOT EXISTS media_storage_path text,
  ADD COLUMN IF NOT EXISTS media_mime text,
  ADD COLUMN IF NOT EXISTS media_file_name text;

CREATE OR REPLACE FUNCTION public.upsert_expo_push_token(_token text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  t text := NULLIF(trim(coalesce(_token, '')), '');
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  UPDATE public.profiles
  SET
    expo_push_token = t,
    expo_push_updated_at = CASE WHEN t IS NULL THEN NULL ELSE now() END
  WHERE id = uid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_expo_push_token(text) TO authenticated;

DROP FUNCTION IF EXISTS public.publish_parent_portal_announcement(uuid, text, text, text);

CREATE OR REPLACE FUNCTION public.publish_parent_portal_announcement(
  _company_id uuid,
  _season text,
  _title text,
  _body text,
  _announcement_id uuid DEFAULT NULL,
  _media_storage_path text DEFAULT NULL,
  _media_mime text DEFAULT NULL,
  _media_file_name text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid := COALESCE(_announcement_id, gen_random_uuid());
  t text := trim(coalesce(_title, ''));
  b text := trim(coalesce(_body, ''));
  path text := NULLIF(trim(coalesce(_media_storage_path, '')), '');
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.user_can_manage_parent_portal_data(uid, _company_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF b = '' AND path IS NULL THEN RAISE EXCEPTION 'Empty announcement'; END IF;

  INSERT INTO public.parent_portal_announcements (
    id,
    company_id,
    season,
    title,
    body,
    is_published,
    published_at,
    created_by,
    media_storage_path,
    media_mime,
    media_file_name
  ) VALUES (
    new_id,
    _company_id,
    _season,
    COALESCE(NULLIF(t, ''), 'Camp announcement'),
    b,
    true,
    now(),
    uid,
    path,
    NULLIF(trim(coalesce(_media_mime, '')), ''),
    NULLIF(trim(coalesce(_media_file_name, '')), '')
  )
  ON CONFLICT (id) DO UPDATE SET
    title = EXCLUDED.title,
    body = EXCLUDED.body,
    media_storage_path = EXCLUDED.media_storage_path,
    media_mime = EXCLUDED.media_mime,
    media_file_name = EXCLUDED.media_file_name,
    published_at = now(),
    is_published = true;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_parent_portal_announcement(uuid, text, text, text, uuid, text, text, text) TO authenticated;

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
        FROM public.parent_portal_announcements a
        WHERE a.media_storage_path = _storage_path
          AND a.is_published
          AND (
            a.company_id IN (SELECT f.company_id FROM public.families f WHERE f.user_id = _user_id)
            OR public.user_can_manage_parent_portal_data(_user_id, a.company_id)
          )
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
