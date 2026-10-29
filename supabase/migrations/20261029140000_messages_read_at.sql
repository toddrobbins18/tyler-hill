-- Read receipts: timestamp when recipient marks a message read.

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS read_at timestamptz;

UPDATE public.messages
SET read_at = COALESCE(created_at, now())
WHERE read = true AND read_at IS NULL;

CREATE OR REPLACE FUNCTION public.set_message_read_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF COALESCE(NEW.read, false) = true AND COALESCE(OLD.read, false) = false THEN
    NEW.read_at := COALESCE(NEW.read_at, now());
  ELSIF COALESCE(NEW.read, false) = false THEN
    NEW.read_at := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_messages_read_at ON public.messages;
CREATE TRIGGER trg_messages_read_at
  BEFORE INSERT OR UPDATE OF read, read_at
  ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.set_message_read_at();

NOTIFY pgrst, 'reload schema';
