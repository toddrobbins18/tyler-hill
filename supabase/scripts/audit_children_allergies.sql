-- Audit children.allergies for active campers (run in Supabase SQL Editor).
-- Run BEFORE deploying sync fix to measure damage; run AFTER to confirm no new wipes.

-- Tyler Hill company_id (adjust per camp)
-- 0d0b7f4f-327e-4497-83ff-3aa501ffc295

-- 1) Summary: how many active 2026 campers have allergy data?
SELECT
  c.company_id,
  co.name AS company_name,
  c.season,
  COUNT(*) FILTER (WHERE c.status = 'active') AS active_campers,
  COUNT(*) FILTER (
    WHERE c.status = 'active'
      AND c.allergies IS NOT NULL
      AND btrim(c.allergies) <> ''
  ) AS with_allergies,
  COUNT(*) FILTER (
    WHERE c.status = 'active'
      AND (c.allergies IS NULL OR btrim(c.allergies) = '')
  ) AS missing_allergies
FROM public.children c
JOIN public.companies co ON co.id = c.company_id
WHERE c.season = '2026'
GROUP BY c.company_id, co.name, c.season
ORDER BY co.name;

-- 2) Recent sync jobs — did a CampMinder sync run around the outage?
SELECT
  j.id,
  co.name AS company_name,
  j.status,
  j.sync_type,
  j.started_at,
  j.completed_at,
  j.error_message,
  j.total_counts
FROM public.sync_jobs j
JOIN public.companies co ON co.id = j.company_id
WHERE j.started_at >= NOW() - INTERVAL '7 days'
ORDER BY j.started_at DESC
LIMIT 30;

-- 3) Campers on upcoming sports rosters with missing allergies (Tyler Hill)
WITH tyler AS (
  SELECT '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid AS company_id
),
upcoming AS (
  SELECT sc.id AS event_id, sc.title, sc.event_date
  FROM public.sports_calendar sc
  CROSS JOIN tyler t
  WHERE sc.company_id = t.company_id
    AND sc.season = '2026'
    AND sc.event_date >= CURRENT_DATE
)
SELECT
  u.title AS event_title,
  u.event_date,
  ch.name AS camper_name,
  ch.allergies,
  ch.updated_at
FROM upcoming u
JOIN public.sports_event_roster ser ON ser.event_id = u.event_id
JOIN public.children ch ON ch.id = ser.child_id
WHERE ch.status = 'active'
  AND (ch.allergies IS NULL OR btrim(ch.allergies) = '')
ORDER BY u.event_date, u.title, ch.name
LIMIT 100;

-- 4) Children updated recently with allergies cleared (possible sync wipe)
SELECT
  ch.name,
  ch.person_id,
  ch.allergies,
  ch.medical_notes,
  ch.updated_at
FROM public.children ch
WHERE ch.company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'
  AND ch.season = '2026'
  AND ch.status = 'active'
  AND (ch.allergies IS NULL OR btrim(ch.allergies) = '')
  AND ch.updated_at >= NOW() - INTERVAL '7 days'
ORDER BY ch.updated_at DESC
LIMIT 50;

-- 5) Upcoming trip/sports rosters missing allergy data (combined)
WITH tyler AS (
  SELECT '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid AS company_id
),
sports_roster_children AS (
  SELECT sc.title AS event_name, sc.event_date, ch.id, ch.name, ch.allergies
  FROM public.sports_calendar sc
  CROSS JOIN tyler t
  JOIN public.sports_event_roster ser ON ser.event_id = sc.id
  JOIN public.children ch ON ch.id = ser.child_id
  WHERE sc.company_id = t.company_id
    AND sc.season = '2026'
    AND sc.event_date >= CURRENT_DATE
    AND ch.status = 'active'
),
trip_children AS (
  SELECT tr.name AS event_name, tr.date AS event_date, ch.id, ch.name, ch.allergies
  FROM public.trips tr
  CROSS JOIN tyler t
  JOIN public.trip_attendees ta ON ta.trip_id = tr.id
  JOIN public.children ch ON ch.id = ta.child_id
  WHERE tr.company_id = t.company_id
    AND tr.season = '2026'
    AND tr.date >= CURRENT_DATE
    AND ch.status = 'active'
)
SELECT * FROM (
  SELECT 'sports' AS source, event_name, event_date, name, allergies FROM sports_roster_children
  UNION ALL
  SELECT 'trip' AS source, event_name, event_date, name, allergies FROM trip_children
) combined
WHERE allergies IS NULL OR btrim(allergies) = ''
ORDER BY event_date, event_name, name
LIMIT 100;
