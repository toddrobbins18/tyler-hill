-- Run in Supabase SQL editor to fix transportation trips that drifted from sports events.
-- Safe to re-run. Does not change driver, bus type, or approval status.

UPDATE public.trips t
SET
  name = sc.title,
  date = sc.event_date,
  departure_time = sc.depart_time,
  destination = sc.location,
  event_type = COALESCE(
    CASE WHEN sc.sport_type = 'Other' THEN sc.custom_sport_type ELSE sc.sport_type END,
    t.event_type
  )
FROM public.sports_calendar sc
WHERE t.sports_event_id = sc.id
  AND (
    t.name IS DISTINCT FROM sc.title
    OR t.date IS DISTINCT FROM sc.event_date
    OR t.departure_time IS DISTINCT FROM sc.depart_time
    OR t.destination IS DISTINCT FROM sc.location
  );

-- Verify Drew Hassenbein / July events
SELECT
  t.name,
  t.date AS trip_date,
  t.departure_time AS trip_departure,
  sc.event_date AS calendar_date,
  sc.depart_time AS calendar_departure,
  t.status,
  t.driver
FROM public.trips t
JOIN public.sports_calendar sc ON sc.id = t.sports_event_id
WHERE t.name ILIKE '%Hassenbein%' OR t.name ILIKE '%Bryn Mawr%'
ORDER BY sc.event_date, t.name;
