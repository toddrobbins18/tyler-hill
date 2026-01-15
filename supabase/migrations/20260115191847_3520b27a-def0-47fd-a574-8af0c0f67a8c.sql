DO $$
BEGIN
  -- Enable realtime events for relevant tables (safe to run multiple times)
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sports_calendar'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_calendar;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'sports_calendar_divisions'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.sports_calendar_divisions;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'activities_field_trips'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.activities_field_trips;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'special_events_activities'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.special_events_activities;
  END IF;
END $$;