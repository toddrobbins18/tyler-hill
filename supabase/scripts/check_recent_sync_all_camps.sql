-- Recent CampMinder sync results — all three camps
-- Tyler Hill | Timber Lake Camp | Timber Lake West

-- =============================================================================
-- 1) Latest sync job per camp (most recent regardless of status)
-- =============================================================================

SELECT DISTINCT ON (c.slug)
  c.name AS camp,
  c.slug,
  j.id AS job_id,
  j.status,
  j.created_at,
  j.started_at,
  j.completed_at,
  j.error_message,
  j.progress->>'syncType' AS sync_type,
  j.progress->>'step' AS last_step,
  j.total_counts->>'staff' AS cm_staff_count,
  j.total_counts->>'staff_synced' AS staff_synced,
  j.total_counts->>'campers' AS cm_camper_count,
  j.total_counts
FROM public.sync_jobs j
JOIN public.companies c ON c.id = j.company_id
WHERE j.entity_type = 'campminder'
  AND c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
ORDER BY c.slug, j.created_at DESC;

-- =============================================================================
-- 2) Last 10 sync jobs per camp (all recent activity)
-- =============================================================================

SELECT
  c.name AS camp,
  j.id AS job_id,
  j.status,
  j.created_at,
  j.completed_at,
  j.error_message,
  j.progress->>'syncType' AS sync_type,
  j.progress->>'step' AS last_step,
  j.total_counts->>'staff' AS cm_staff,
  j.total_counts->>'staff_synced' AS staff_synced,
  EXTRACT(EPOCH FROM (COALESCE(j.completed_at, now()) - j.created_at)) / 60 AS minutes_elapsed
FROM public.sync_jobs j
JOIN public.companies c ON c.id = j.company_id
WHERE j.entity_type = 'campminder'
  AND c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
ORDER BY j.created_at DESC
LIMIT 30;

-- =============================================================================
-- 3) Staff-only syncs today (last 24h)
-- =============================================================================

SELECT
  c.name AS camp,
  j.id AS job_id,
  j.status,
  j.created_at,
  j.completed_at,
  j.error_message,
  j.progress->>'step' AS last_step,
  j.total_counts->>'staff' AS cm_staff_count,
  j.total_counts->>'staff_synced' AS staff_synced
FROM public.sync_jobs j
JOIN public.companies c ON c.id = j.company_id
WHERE j.entity_type = 'campminder'
  AND c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
  AND j.created_at >= now() - interval '24 hours'
  AND (
    j.progress->>'syncType' = 'staff'
    OR j.progress->>'step' ILIKE '%staff%'
    OR (j.total_counts->>'campers')::int = 0
  )
ORDER BY j.created_at DESC;

-- =============================================================================
-- 4) Current staff counts vs Todd targets (after syncs)
-- =============================================================================

SELECT
  c.name AS camp,
  COUNT(*) FILTER (WHERE COALESCE(LOWER(s.status), 'active') NOT IN ('inactive')) AS nest_active,
  COUNT(*) FILTER (WHERE LOWER(COALESCE(s.status, '')) = 'inactive') AS nest_inactive,
  CASE c.slug
    WHEN 'tyler-hill-camp' THEN 344
    WHEN 'timber-lake-camp' THEN 308
    WHEN 'timber-lake-west' THEN 235
  END AS todd_target,
  CASE c.slug
    WHEN 'tyler-hill-camp' THEN 344
    WHEN 'timber-lake-camp' THEN 308
    WHEN 'timber-lake-west' THEN 235
  END - COUNT(*) FILTER (WHERE COALESCE(LOWER(s.status), 'active') NOT IN ('inactive')) AS gap_vs_todd,
  c.campminder_last_sync_at AS last_sync_at
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE s.season = '2026'
  AND c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
GROUP BY c.slug, c.name, c.campminder_last_sync_at
ORDER BY c.name;

-- =============================================================================
-- 5) Stuck / failed jobs (need attention)
-- =============================================================================

SELECT
  c.name AS camp,
  j.id AS job_id,
  j.status,
  j.created_at,
  j.progress->>'step' AS last_step,
  j.error_message,
  EXTRACT(EPOCH FROM (now() - j.updated_at)) / 60 AS minutes_since_update
FROM public.sync_jobs j
JOIN public.companies c ON c.id = j.company_id
WHERE j.entity_type = 'campminder'
  AND c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
  AND j.status IN ('running', 'pending', 'failed')
  AND j.created_at >= now() - interval '7 days'
ORDER BY j.created_at DESC;
