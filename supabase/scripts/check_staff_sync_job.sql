-- Check Tyler Hill staff sync job results
-- Job ID from manual staff sync: 324c1b90-4145-4569-8de2-ab6fd5fea2d4

-- 1) This specific job (status, counts, errors)
SELECT
  j.id,
  c.name AS camp,
  j.status,
  j.entity_type,
  j.created_at,
  j.started_at,
  j.updated_at,
  j.completed_at,
  j.error_message,
  j.total_counts,
  j.progress
FROM public.sync_jobs j
LEFT JOIN public.companies c ON c.id = j.company_id
WHERE j.id = '324c1b90-4145-4569-8de2-ab6fd5fea2d4'::uuid;

-- 2) Recent Tyler Hill staff sync jobs (last 5)
SELECT
  j.id,
  j.status,
  j.created_at,
  j.completed_at,
  j.error_message,
  j.total_counts->>'staff' AS cm_staff_count,
  j.total_counts->>'staff_synced' AS staff_synced,
  j.progress->>'step' AS last_step,
  j.progress->>'syncType' AS sync_type
FROM public.sync_jobs j
WHERE j.company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND j.entity_type = 'campminder'
ORDER BY j.created_at DESC
LIMIT 5;

-- 3) Staff counts AFTER sync (compare to Todd 344)
SELECT
  COUNT(*) FILTER (WHERE COALESCE(LOWER(status), 'active') NOT IN ('inactive')) AS nest_active,
  COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) = 'inactive') AS nest_inactive,
  COUNT(*) AS total
FROM public.staff
WHERE company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND season = '2026';

-- 4) If still 397: CM API likely returned ~397 active (Nest matches API, not Todd UI)
--    Check total_counts->staff in job row above.
--    If total_counts.staff = 397 → sync worked; Todd's 344 uses a different CM filter.
--    If total_counts.staff = 344 but nest_active = 397 → cleanup was SKIPPED (check Edge logs for SKIPPING inactivation)
