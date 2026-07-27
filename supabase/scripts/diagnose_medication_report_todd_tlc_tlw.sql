-- Todd: medication report + division alias check — Timber Lake & Timber Lake West
-- Run in Supabase SQL Editor

-- =============================================================================
-- 1) Medication data exists? (root cause if zero rows in report)
-- =============================================================================
SELECT
  c.name AS camp,
  c.slug,
  ml.season,
  COUNT(*) AS medication_log_rows,
  COUNT(DISTINCT ml.child_id) AS unique_children
FROM public.companies c
LEFT JOIN public.medication_logs ml ON ml.company_id = c.id
WHERE c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
GROUP BY c.name, c.slug, ml.season
ORDER BY c.slug, ml.season DESC NULLS LAST;

-- =============================================================================
-- 2) Teen / Super division alias drift (Tyler Hill-style buckets only)
-- =============================================================================
SELECTgo
  c.name AS camp,
  d.name AS division,
  d.is_active,
  public.normalize_division_name_for_filter(d.name) AS bucket,
  COUNT(ch.id) FILTER (WHERE ch.season = '2026' AND ch.status = 'active') AS active_campers_2026
FROM public.companies c
JOIN public.divisions d ON d.company_id = c.id
LEFT JOIN public.children ch ON ch.division_id = d.id AND ch.company_id = c.id
WHERE c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
  AND public.normalize_division_name_for_filter(d.name) IN (
    'teen boys', 'teen girls', 'super boys', 'super girls'
  )
GROUP BY c.name, d.name, d.is_active, bucket, d.sort_order
ORDER BY c.name, bucket, d.is_active DESC, d.name;

-- =============================================================================
-- 3) Timber Lake West — teen divisions (their naming is different)
-- =============================================================================
SELECT
  d.name AS division,
  COUNT(ch.id) FILTER (WHERE ch.season = '2026' AND ch.status = 'active') AS active_campers,
  COUNT(ml.id) FILTER (WHERE ml.season = '2026') AS med_logs_2026
FROM public.companies c
JOIN public.divisions d ON d.company_id = c.id
LEFT JOIN public.children ch ON ch.division_id = d.id AND ch.company_id = c.id
LEFT JOIN public.medication_logs ml ON ml.child_id = ch.id AND ml.company_id = c.id
WHERE c.slug = 'timber-lake-west'
  AND d.name ILIKE '%teen%'
GROUP BY d.name, d.sort_order
ORDER BY d.sort_order;

-- =============================================================================
-- 4) Timber Lake Camp — teen divisions
-- =============================================================================
SELECT
  d.name AS division,
  COUNT(ch.id) FILTER (WHERE ch.season = '2026' AND ch.status = 'active') AS active_campers,
  COUNT(ml.id) FILTER (WHERE ml.season = '2026') AS med_logs_2026
FROM public.companies c
JOIN public.divisions d ON d.company_id = c.id
LEFT JOIN public.children ch ON ch.division_id = d.id AND ch.company_id = c.id
LEFT JOIN public.medication_logs ml ON ml.child_id = ch.id AND ml.company_id = c.id
WHERE c.slug = 'timber-lake-camp'
  AND (d.name ILIKE '%teen%' OR d.name ILIKE '%super%')
GROUP BY d.name, d.sort_order
ORDER BY d.sort_order;
