-- Message photo/video attachments (training sandbox only at DB layer for media_kind != text).

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS message_kind text NOT NULL DEFAULT 'text';

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_storage_path text;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_mime text;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS media_file_name text;

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_message_kind_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_message_kind_check
  CHECK (message_kind IN ('text', 'image', 'video'));

ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS message_kind text NOT NULL DEFAULT 'text';

ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS media_storage_path text;

ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS media_mime text;

ALTER TABLE public.group_messages
  ADD COLUMN IF NOT EXISTS media_file_name text;

ALTER TABLE public.group_messages
  DROP CONSTRAINT IF EXISTS group_messages_message_kind_check;

ALTER TABLE public.group_messages
  ADD CONSTRAINT group_messages_message_kind_check
  CHECK (message_kind IN ('text', 'image', 'video'));

CREATE OR REPLACE FUNCTION public.enforce_sandbox_only_message_media()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  camp_id uuid;
  camp_slug text;
BEGIN
  IF COALESCE(NEW.message_kind, 'text') = 'text' THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'messages' THEN
    camp_id := NEW.company_id;
  ELSE
    SELECT mg.company_id INTO camp_id
    FROM public.message_groups mg
    WHERE mg.id = NEW.group_id;
  END IF;

  IF camp_id IS NULL THEN
    RAISE EXCEPTION 'Media messages require company context';
  END IF;

  SELECT slug INTO camp_slug FROM public.companies WHERE id = camp_id;

  IF camp_slug IS DISTINCT FROM 'nest-sandbox-day-camp' THEN
    RAISE EXCEPTION 'Photo/video messages are enabled for Nest Training Sandbox only';
  END IF;

  IF NEW.media_storage_path IS NULL OR length(trim(NEW.media_storage_path)) = 0 THEN
    RAISE EXCEPTION 'Media messages require media_storage_path';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_sandbox_media ON public.messages;
CREATE TRIGGER trg_messages_sandbox_media
  BEFORE INSERT OR UPDATE OF message_kind, media_storage_path, company_id
  ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_sandbox_only_message_media();

DROP TRIGGER IF EXISTS trg_group_messages_sandbox_media ON public.group_messages;
CREATE TRIGGER trg_group_messages_sandbox_media
  BEFORE INSERT OR UPDATE OF message_kind, media_storage_path, group_id
  ON public.group_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_sandbox_only_message_media();

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('message-media', 'message-media', false, NULL)
ON CONFLICT (id) DO UPDATE SET public = false, file_size_limit = NULL;

CREATE OR REPLACE FUNCTION public.user_can_access_message_media(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id)
    OR _company_id = public.get_user_company(_user_id)
    OR public.user_has_role_for_company(
      _user_id,
      _company_id,
      ARRAY['admin', 'staff', 'division_leader', 'specialist', 'health_center', 'viewer']::public.app_role[]
    );
$$;

DROP POLICY IF EXISTS "Message media read" ON storage.objects;
CREATE POLICY "Message media read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'message-media'
    AND public.user_can_access_message_media(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  );

DROP POLICY IF EXISTS "Message media insert" ON storage.objects;
CREATE POLICY "Message media insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'message-media'
    AND public.user_can_access_message_media(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid
    )
  );

DROP POLICY IF EXISTS "Message media delete own upload" ON storage.objects;
CREATE POLICY "Message media delete own upload"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'message-media'
    AND owner = auth.uid()
  );
