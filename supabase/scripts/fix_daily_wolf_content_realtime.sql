-- Run in Supabase SQL editor (same as migration 20260701140000).

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
