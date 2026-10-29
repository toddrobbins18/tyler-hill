-- Enable photo/video/audio/file attachments for all camps (not training sandbox only).

ALTER TABLE public.messages
  DROP CONSTRAINT IF EXISTS messages_message_kind_check;

ALTER TABLE public.messages
  ADD CONSTRAINT messages_message_kind_check
  CHECK (message_kind IN ('text', 'image', 'video', 'audio', 'file'));

ALTER TABLE public.group_messages
  DROP CONSTRAINT IF EXISTS group_messages_message_kind_check;

ALTER TABLE public.group_messages
  ADD CONSTRAINT group_messages_message_kind_check
  CHECK (message_kind IN ('text', 'image', 'video', 'audio', 'file'));

CREATE OR REPLACE FUNCTION public.enforce_sandbox_only_message_media()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  camp_id uuid;
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

  IF NEW.media_storage_path IS NULL OR length(trim(NEW.media_storage_path)) = 0 THEN
    RAISE EXCEPTION 'Media messages require media_storage_path';
  END IF;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
