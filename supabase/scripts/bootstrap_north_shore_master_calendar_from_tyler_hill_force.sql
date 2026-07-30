-- Force re-copy Tyler Hill 2026 calendar → North Shore (replaces existing NS calendar rows).
-- Run in Supabase SQL Editor when North Shore only has test data and you want Tyler Hill parity.

DO $$
DECLARE
  th_company_id uuid;
  ns_company_id uuid;
  ns_division_id uuid;
  src record;
  new_id uuid;
BEGIN
  SELECT id INTO th_company_id FROM public.companies WHERE slug = 'tyler-hill-camp';
  SELECT id INTO ns_company_id FROM public.companies WHERE slug = 'north-shore-day-camp';

  IF th_company_id IS NULL OR ns_company_id IS NULL THEN
    RAISE EXCEPTION 'Tyler Hill or North Shore Day Camp company row not found';
  END IF;

  SELECT d.id INTO ns_division_id
  FROM public.divisions d
  WHERE d.company_id = ns_company_id AND d.is_active = true
  ORDER BY d.sort_order NULLS LAST, d.name
  LIMIT 1;

  DELETE FROM public.sports_calendar_divisions WHERE company_id = ns_company_id;
  DELETE FROM public.activities_field_trips_divisions WHERE company_id = ns_company_id;
  DELETE FROM public.special_events_divisions WHERE company_id = ns_company_id;
  DELETE FROM public.sports_calendar WHERE company_id = ns_company_id;
  DELETE FROM public.activities_field_trips WHERE company_id = ns_company_id;
  DELETE FROM public.special_events_activities WHERE company_id = ns_company_id;

  FOR src IN
    SELECT * FROM public.activities_field_trips
    WHERE company_id = th_company_id AND (season = '2026' OR season IS NULL)
  LOOP
    new_id := gen_random_uuid();
    INSERT INTO public.activities_field_trips (
      id, event_date, title, description, activity_type, time, location, capacity,
      chaperone, division_id, created_by, company_id, season, meal_options, meal_notes,
      emoji, sub_category, is_multi_day, end_date
    ) VALUES (
      new_id, src.event_date, src.title, src.description, src.activity_type, src.time,
      src.location, src.capacity, src.chaperone, ns_division_id, src.created_by,
      ns_company_id, COALESCE(src.season, '2026'), src.meal_options, src.meal_notes,
      src.emoji, src.sub_category, src.is_multi_day, src.end_date
    );
    IF ns_division_id IS NOT NULL THEN
      INSERT INTO public.activities_field_trips_divisions (activity_id, division_id, company_id)
      VALUES (new_id, ns_division_id, ns_company_id) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  FOR src IN
    SELECT * FROM public.special_events_activities
    WHERE company_id = th_company_id AND (season = '2026' OR season IS NULL)
  LOOP
    new_id := gen_random_uuid();
    INSERT INTO public.special_events_activities (
      id, event_date, title, description, event_type, time_slot, location, division_id,
      created_by, company_id, season, start_time, end_time, sub_category, emoji
    ) VALUES (
      new_id, src.event_date, src.title, src.description, src.event_type, src.time_slot,
      src.location, ns_division_id, src.created_by, ns_company_id,
      COALESCE(src.season, '2026'), src.start_time, src.end_time, src.sub_category, src.emoji
    );
    IF ns_division_id IS NOT NULL THEN
      INSERT INTO public.special_events_divisions (event_id, division_id, company_id)
      VALUES (new_id, ns_division_id, ns_company_id) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;

  FOR src IN
    SELECT * FROM public.sports_calendar
    WHERE company_id = th_company_id AND (season = '2026' OR season IS NULL)
  LOOP
    new_id := gen_random_uuid();
    INSERT INTO public.sports_calendar (
      id, event_date, title, description, sport_type, custom_sport_type, event_type,
      time, depart_time, start_time_field, location, team, opponent, home_away,
      division_id, division_provides_coach, division_provides_ref,
      created_by, company_id, season, meal_options, meal_notes, emoji
    ) VALUES (
      new_id, src.event_date, src.title, src.description, src.sport_type, src.custom_sport_type,
      src.event_type, src.time, src.depart_time, src.start_time_field, src.location, src.team,
      src.opponent, src.home_away, ns_division_id, src.division_provides_coach, src.division_provides_ref,
      src.created_by, ns_company_id, COALESCE(src.season, '2026'), src.meal_options, src.meal_notes, src.emoji
    );
    IF ns_division_id IS NOT NULL THEN
      INSERT INTO public.sports_calendar_divisions (sports_event_id, division_id, company_id)
      VALUES (new_id, ns_division_id, ns_company_id) ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

SELECT
  (SELECT COUNT(*) FROM public.sports_calendar sc JOIN public.companies c ON c.id = sc.company_id WHERE c.slug = 'north-shore-day-camp') AS sports,
  (SELECT COUNT(*) FROM public.activities_field_trips a JOIN public.companies c ON c.id = a.company_id WHERE c.slug = 'north-shore-day-camp') AS activities,
  (SELECT COUNT(*) FROM public.special_events_activities s JOIN public.companies c ON c.id = s.company_id WHERE c.slug = 'north-shore-day-camp') AS special_events;
