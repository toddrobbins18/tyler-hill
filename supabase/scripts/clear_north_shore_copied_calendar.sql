-- Remove Tyler Hill calendar data that was copied into North Shore Day Camp
-- (bootstrap_north_shore_master_calendar_from_tyler_hill.sql).
--
-- Clears Master Calendar sources: sports, activities/field trips, special events.
-- Does NOT touch Tyler Hill or other camps.
--
-- Run in Supabase SQL Editor. Review PREVIEW, then run CLEAR.

-- =============================================================================
-- PREVIEW — compare counts vs Tyler Hill (2026)
-- =============================================================================

SELECT
  c.slug AS camp,
  (SELECT COUNT(*) FROM public.sports_calendar sc WHERE sc.company_id = c.id AND (sc.season = '2026' OR sc.season IS NULL)) AS sports,
  (SELECT COUNT(*) FROM public.activities_field_trips a WHERE a.company_id = c.id AND (a.season = '2026' OR a.season IS NULL)) AS activities,
  (SELECT COUNT(*) FROM public.special_events_activities s WHERE s.company_id = c.id AND (s.season = '2026' OR s.season IS NULL)) AS special_events
FROM public.companies c
WHERE c.slug IN ('north-shore-day-camp', 'tyler-hill-camp')
ORDER BY c.slug;

-- =============================================================================
-- CLEAR — North Shore only (uncomment and run after preview looks right)
-- =============================================================================

/*
DO $$
DECLARE
  ns_id uuid;
BEGIN
  SELECT id INTO ns_id FROM public.companies WHERE slug = 'north-shore-day-camp';
  IF ns_id IS NULL THEN
    RAISE EXCEPTION 'north-shore-day-camp not found';
  END IF;

  DELETE FROM public.sports_calendar_divisions WHERE company_id = ns_id;
  DELETE FROM public.activities_field_trips_divisions WHERE company_id = ns_id;
  DELETE FROM public.special_events_divisions WHERE company_id = ns_id;
  DELETE FROM public.sports_calendar WHERE company_id = ns_id;
  DELETE FROM public.activities_field_trips WHERE company_id = ns_id;
  DELETE FROM public.special_events_activities WHERE company_id = ns_id;

  RAISE NOTICE 'North Shore calendar cleared (sports, activities, special events).';
END $$;
*/

-- =============================================================================
-- VERIFY — should all be 0 for North Shore
-- =============================================================================

SELECT
  (SELECT COUNT(*) FROM public.sports_calendar sc JOIN public.companies c ON c.id = sc.company_id WHERE c.slug = 'north-shore-day-camp') AS sports,
  (SELECT COUNT(*) FROM public.activities_field_trips a JOIN public.companies c ON c.id = a.company_id WHERE c.slug = 'north-shore-day-camp') AS activities,
  (SELECT COUNT(*) FROM public.special_events_activities s JOIN public.companies c ON c.id = s.company_id WHERE c.slug = 'north-shore-day-camp') AS special_events;
