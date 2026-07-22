-- Staff totals vs Todd's CampMinder figures (2026 season)
-- Todd: Tyler Hill 344 | Timber Lake Camp 308 | Timber Lake West 235

-- =============================================================================
-- 1) SUMMARY — one row per camp (run this first)
-- =============================================================================

SELECT
  c.slug,
  c.name AS camp,
  COUNT(*) FILTER (
    WHERE COALESCE(LOWER(s.status), 'active') NOT IN ('inactive')
  ) AS nest_active,
  COUNT(*) FILTER (
    WHERE LOWER(COALESCE(s.status, '')) = 'inactive'
  ) AS nest_inactive,
  COUNT(*) AS nest_total,
  CASE c.slug
    WHEN 'tyler-hill-camp' THEN 344
    WHEN 'timber-lake-camp' THEN 308
    WHEN 'timber-lake-west' THEN 235
    ELSE NULL
  END AS todd_active,
  CASE c.slug
    WHEN 'tyler-hill-camp' THEN 344
    WHEN 'timber-lake-camp' THEN 308
    WHEN 'timber-lake-west' THEN 235
    ELSE NULL
  END - COUNT(*) FILTER (
    WHERE COALESCE(LOWER(s.status), 'active') NOT IN ('inactive')
  ) AS gap_vs_todd
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE s.season = '2026'
  AND c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
GROUP BY c.slug, c.name
ORDER BY c.name;

-- =============================================================================
-- 2) ALL STAFF — full list with camp, status, person_id (for auditing)
-- =============================================================================

SELECT
  c.name AS camp,
  s.name,
  s.role,
  s.status,
  s.person_id,
  CASE
    WHEN s.person_id IS NULL OR TRIM(s.person_id) = '' THEN 'no_cm_link'
    ELSE 'has_cm_link'
  END AS cm_link,
  s.email,
  s.updated_at
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE s.season = '2026'
  AND c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
ORDER BY c.name, s.status, s.name;

-- =============================================================================
-- 3) ACTIVE ONLY — who counts toward Staff page (vs Todd)
-- =============================================================================

SELECT
  c.name AS camp,
  s.name,
  s.role,
  s.person_id,
  s.email
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE s.season = '2026'
  AND c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
  AND COALESCE(LOWER(s.status), 'active') NOT IN ('inactive')
  AND s.name IS NOT NULL
  AND s.name <> 'Unknown'
ORDER BY c.name, s.name;

-- =============================================================================
-- 4) INACTIVE ONLY — hidden from Staff page
-- =============================================================================

SELECT
  c.name AS camp,
  s.name,
  s.role,
  s.person_id,
  s.updated_at
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE s.season = '2026'
  AND c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
  AND LOWER(COALESCE(s.status, '')) = 'inactive'
ORDER BY c.name, s.updated_at DESC, s.name;

-- =============================================================================
-- 5) EXTRAS vs Todd — active staff ABOVE Todd's count (by camp breakdown)
-- =============================================================================

WITH todd AS (
  SELECT 'tyler-hill-camp'::text AS slug, 344 AS expected UNION ALL
  SELECT 'timber-lake-camp', 308 UNION ALL
  SELECT 'timber-lake-west', 235
),
counts AS (
  SELECT
    c.slug,
    c.name AS camp,
    COUNT(*) FILTER (
      WHERE COALESCE(LOWER(s.status), 'active') NOT IN ('inactive')
    ) AS active_count
  FROM public.staff s
  JOIN public.companies c ON c.id = s.company_id
  WHERE s.season = '2026'
    AND c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
  GROUP BY c.slug, c.name
)
SELECT
  counts.camp,
  counts.active_count AS nest_active,
  todd.expected AS todd_active,
  counts.active_count - todd.expected AS over_under,
  CASE
    WHEN counts.active_count > todd.expected THEN 'OVER (extra rows in Nest)'
    WHEN counts.active_count < todd.expected THEN 'UNDER (missing from Nest)'
    ELSE 'MATCH'
  END AS status
FROM counts
JOIN todd ON todd.slug = counts.slug
ORDER BY counts.camp;

-- =============================================================================
-- 6) Active WITHOUT person_id — legacy rows not in CampMinder
-- =============================================================================

SELECT
  c.name AS camp,
  COUNT(*) AS active_no_person_id
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE s.season = '2026'
  AND c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
  AND COALESCE(LOWER(s.status), 'active') NOT IN ('inactive')
  AND (s.person_id IS NULL OR TRIM(s.person_id) = '')
GROUP BY c.name
ORDER BY c.name;
