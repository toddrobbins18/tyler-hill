-- Verify Timber Lake West OD setup (RLS + Jack's schedule load)
-- Run in Supabase SQL Editor after fix_od_management_rls + load_timber_lake_west_od_schedule

-- =============================================================================
-- 1) Infrastructure — bunks, assignments, schedule rows exist
-- =============================================================================
SELECT
  c.name AS camp,
  (SELECT COUNT(*) FROM public.bunks b WHERE b.company_id = c.id AND b.season = '2026' AND b.is_active = true) AS active_bunks,
  (SELECT COUNT(*) FROM public.bunk_staff bs WHERE bs.company_id = c.id AND bs.season = '2026') AS bunk_staff_rows,
  (SELECT COUNT(DISTINCT sdo.staff_id) FROM public.staff_days_off sdo WHERE sdo.company_id = c.id AND sdo.season = '2026') AS staff_with_schedule,
  (SELECT COUNT(*) FROM public.staff_days_off sdo WHERE sdo.company_id = c.id AND sdo.season = '2026') AS total_schedule_rows,
  (SELECT MIN(sdo.date) FROM public.staff_days_off sdo WHERE sdo.company_id = c.id AND sdo.season = '2026') AS first_date,
  (SELECT MAX(sdo.date) FROM public.staff_days_off sdo WHERE sdo.company_id = c.id AND sdo.season = '2026') AS last_date
FROM public.companies c
WHERE c.slug = 'timber-lake-west';

-- Expected: active_bunks ~36, bunk_staff_rows ~179, staff_with_schedule = 124,
-- total_schedule_rows ~6000–7000, first_date 2026-06-01, last_date 2026-08-31

-- =============================================================================
-- 2) Pattern sanity — each pattern type should have expected counts
-- =============================================================================
SELECT
  CASE
    WHEN sdo.notes ILIKE '%highlighted%' THEN 'highlighted'
    WHEN sdo.notes = 'Monday day off' THEN 'monday_off'
    WHEN sdo.notes = 'Tuesday day off' THEN 'tuesday_off'
    WHEN sdo.notes = 'Wednesday day off' THEN 'wednesday_off'
    WHEN sdo.notes = 'Night off' THEN 'night_only'
    ELSE 'other'
  END AS pattern_type,
  COUNT(DISTINCT sdo.staff_id) AS staff_count,
  ROUND(AVG(per_staff.rows)::numeric, 1) AS avg_rows_per_staff
FROM public.staff_days_off sdo
JOIN public.companies c ON c.id = sdo.company_id
JOIN (
  SELECT staff_id, COUNT(*) AS rows
  FROM public.staff_days_off
  WHERE season = '2026'
  GROUP BY staff_id
) per_staff ON per_staff.staff_id = sdo.staff_id
WHERE c.slug = 'timber-lake-west'
  AND sdo.season = '2026'
GROUP BY 1
ORDER BY 1;

-- Expected roughly:
--   monday_off    ~15 staff, ~53 rows each
--   tuesday_off   ~18 staff, ~53 rows each
--   wednesday_off ~normal Wed staff (not highlighted), ~53 rows each
--   highlighted   ~15 staff, ~52 rows each

-- =============================================================================
-- 3) Spot-check highlighted vs normal (same day-off column, different nights)
-- =============================================================================
SELECT
  s.name,
  COUNT(*) FILTER (WHERE sdo.is_day_off) AS day_off_dates,
  COUNT(*) FILTER (WHERE sdo.is_night_off) AS night_off_dates,
  COUNT(*) FILTER (WHERE sdo.notes ILIKE '%highlighted%') AS highlighted_nights
FROM public.staff_days_off sdo
JOIN public.staff s ON s.id = sdo.staff_id
JOIN public.companies c ON c.id = sdo.company_id
WHERE c.slug = 'timber-lake-west'
  AND sdo.season = '2026'
  AND s.name IN (
    'Sacha Wacks',        -- highlighted Wed
    'Charlie Boyles',     -- normal Wed
    'David Lord',         -- normal Tue
    'Chandler Nelms',     -- normal Mon
    'Skylar Rand',        -- highlighted Wed
    'Zachary Greez'       -- highlighted Wed
  )
GROUP BY s.name
ORDER BY s.name;

-- Sacha / Skylar / Zachary: highlighted_nights > 0, night_off_dates ~52
-- Charlie (normal Wed): highlighted_nights = 0, night_off_dates ~53

-- =============================================================================
-- 4) Tonight check — who should appear on Off tab for a given date
--    Change the date below to whatever you are testing in the app.
-- =============================================================================
SELECT
  s.name,
  sdo.date,
  sdo.is_day_off,
  sdo.is_night_off,
  sdo.notes
FROM public.staff_days_off sdo
JOIN public.staff s ON s.id = sdo.staff_id
JOIN public.companies c ON c.id = sdo.company_id
WHERE c.slug = 'timber-lake-west'
  AND sdo.season = '2026'
  AND sdo.date = '2026-07-28'   -- <-- change this date
  AND (sdo.is_day_off OR sdo.is_night_off)
ORDER BY s.name
LIMIT 50;

-- Also show count for that date:
SELECT COUNT(DISTINCT sdo.staff_id) AS staff_off_that_night
FROM public.staff_days_off sdo
JOIN public.companies c ON c.id = sdo.company_id
WHERE c.slug = 'timber-lake-west'
  AND sdo.season = '2026'
  AND sdo.date = '2026-07-28'   -- <-- same date
  AND (sdo.is_day_off OR sdo.is_night_off);

-- =============================================================================
-- 5) Night pattern by weekday — verify rules for one sample staff per pattern
-- =============================================================================
SELECT
  s.name,
  to_char(sdo.date, 'Dy') AS weekday,
  COUNT(*) AS nights
FROM public.staff_days_off sdo
JOIN public.staff s ON s.id = sdo.staff_id
JOIN public.companies c ON c.id = sdo.company_id
WHERE c.slug = 'timber-lake-west'
  AND sdo.season = '2026'
  AND sdo.is_night_off
  AND s.name IN ('David Lord', 'Chandler Nelms', 'Charlie Boyles', 'Sacha Wacks')
GROUP BY s.name, to_char(sdo.date, 'Dy'), EXTRACT(dow FROM sdo.date)
ORDER BY s.name, EXTRACT(dow FROM sdo.date);

-- Expected night-off weekdays:
--   Chandler Nelms (Mon off): Sun, Mon, Wed, Thu
--   David Lord (Tue off):     Mon, Tue, Thu, Fri
--   Charlie Boyles (Wed off): Sun, Tue, Wed, Fri
--   Sacha Wacks (highlight):  Sun, Tue, Wed, Thu
