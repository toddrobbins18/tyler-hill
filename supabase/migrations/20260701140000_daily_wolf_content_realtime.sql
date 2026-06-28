-- Enable live updates for Daily Wolf / Tiger Times content on web + mobile.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'daily_wolf_content'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.daily_wolf_content;
  END IF;
END $$;
