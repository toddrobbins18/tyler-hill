-- Timber Lake West 2027: fix inflated staff count (232 active → ~13 from CampMinder)
--
-- STEP 0 — Check current counts
SELECT
  COUNT(*) FILTER (WHERE COALESCE(LOWER(s.status), 'active') NOT IN ('inactive')) AS active,
  COUNT(*) FILTER (WHERE LOWER(COALESCE(s.status, '')) = 'inactive') AS inactive
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE c.slug = 'timber-lake-west'
  AND s.season = '2027';

-- STEP 1 — Cancel stuck sync jobs (if any show status = 'running' for hours)
-- PREVIEW stuck jobs:
SELECT j.id, j.status, j.created_at, j.progress->>'step' AS step
FROM public.sync_jobs j
JOIN public.companies c ON c.id = j.company_id
WHERE c.slug = 'timber-lake-west'
  AND j.entity_type = 'campminder'
  AND j.status IN ('running', 'pending')
ORDER BY j.created_at DESC;

-- Uncomment to mark stuck jobs failed (safe if running > 30 min):
/*
UPDATE public.sync_jobs j
SET status = 'failed',
    error_message = 'Manually cancelled — stuck job',
    completed_at = now()
FROM public.companies c
WHERE j.company_id = c.id
  AND c.slug = 'timber-lake-west'
  AND j.entity_type = 'campminder'
  AND j.status IN ('running', 'pending')
  AND j.created_at < now() - interval '30 minutes';
*/

-- STEP 2 — Inactivate ALL active 2027 TLW staff (rollover copies)
-- PREVIEW:
SELECT COUNT(*) AS will_inactivate
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE c.slug = 'timber-lake-west'
  AND s.season = '2027'
  AND COALESCE(LOWER(s.status), 'active') NOT IN ('inactive');

-- RUN THIS UPDATE (copy/paste — not commented):
UPDATE public.staff s
SET status = 'inactive', updated_at = now()
FROM public.companies c
WHERE s.company_id = c.id
  AND c.slug = 'timber-lake-west'
  AND s.season = '2027'
  AND COALESCE(LOWER(s.status), 'active') NOT IN ('inactive');

-- After STEP 2 you should see: active = 0, inactive = 362 (232+130)

-- STEP 3 — In Nest UI:
--   Admin → Data Import → Timber Lake West → **Staff Only** sync
--   Season dropdown must be **2027**
-- Sync reactivates only CampMinder hired staff (~13).

-- STEP 4 — Verify
SELECT
  COUNT(*) FILTER (WHERE COALESCE(LOWER(s.status), 'active') NOT IN ('inactive')) AS active,
  COUNT(*) FILTER (WHERE LOWER(COALESCE(s.status, '')) = 'inactive') AS inactive
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE c.slug = 'timber-lake-west'
  AND s.season = '2027';
