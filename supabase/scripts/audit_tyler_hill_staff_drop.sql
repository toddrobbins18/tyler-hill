-- Why did Tyler Hill staff drop from "500+" to 235 active?
-- Run in Supabase SQL Editor (read-only)

-- Tyler Hill company_id: 0d0b7f4f-327e-4497-83ff-3aa501ffc295

-- 1) Counts by SEASON (were 500+ multiple seasons combined?)
SELECT
  season,
  COUNT(*) FILTER (WHERE COALESCE(LOWER(status), 'active') NOT IN ('inactive')) AS active,
  COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) = 'inactive') AS inactive,
  COUNT(*) AS total
FROM public.staff
WHERE company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
GROUP BY season
ORDER BY season DESC;

-- 2) ALL camps combined (super admin / wrong filter could show ~630 active)
SELECT
  COUNT(*) FILTER (WHERE COALESCE(LOWER(s.status), 'active') NOT IN ('inactive')) AS all_camps_active_2026,
  COUNT(*) AS all_camps_total_2026
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE s.season = '2026' AND c.is_active = true;

-- 3) Tyler Hill: inactivated in last 48h (sync spike?)
SELECT COUNT(*) AS inactivated_last_48h
FROM public.staff
WHERE company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND season = '2026'
  AND LOWER(COALESCE(status, '')) = 'inactive'
  AND updated_at >= now() - interval '48 hours';

SELECT
  DATE(updated_at AT TIME ZONE 'America/New_York') AS day_et,
  COUNT(*) AS count
FROM public.staff
WHERE company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND season = '2026'
  AND LOWER(COALESCE(status, '')) = 'inactive'
  AND updated_at >= now() - interval '14 days'
GROUP BY 1
ORDER BY 1 DESC;

-- 4) Duplicate person_id rows (upsert merges — could reduce visible count)
SELECT person_id, COUNT(*) AS row_count, STRING_AGG(name || ' (' || season || ')', ', ') AS names
FROM public.staff
WHERE company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND season = '2026'
  AND person_id IS NOT NULL
GROUP BY person_id
HAVING COUNT(*) > 1
ORDER BY row_count DESC
LIMIT 30;

-- 5) Staff on WRONG company that might have been visible before lifeguard fix
SELECT c.name AS company, COUNT(*) AS lifeguard_count
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE s.season = '2026'
  AND s.role ILIKE '%lifeguard%'
GROUP BY c.name;

-- 6) Records WITHOUT person_id (sync cleanup can't match CM — often inactivated)
SELECT
  COUNT(*) FILTER (WHERE COALESCE(LOWER(status), 'active') NOT IN ('inactive')) AS active_no_person_id,
  COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) = 'inactive') AS inactive_no_person_id
FROM public.staff
WHERE company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND season = '2026'
  AND (person_id IS NULL OR TRIM(person_id) = '');

-- 7) Recent staff sync jobs for Tyler Hill
SELECT id, entity_type, status, created_at, completed_at, total_counts, error_message
FROM public.sync_jobs
WHERE company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
ORDER BY created_at DESC
LIMIT 15;
