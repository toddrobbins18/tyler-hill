-- Diagnose division alias drift + medication data for all three camps.

-- 1) Duplicate buckets (active + inactive alias rows)
SELECT
  c.name AS camp,
  public.normalize_division_name_for_filter(d.name) AS bucket,
  COUNT(*) AS division_rows,
  COUNT(*) FILTER (WHERE d.is_active) AS active_rows,
  COUNT(*) FILTER (WHERE NOT d.is_active) AS inactive_rows
FROM public.companies c
JOIN public.divisions d ON d.company_id = c.id
WHERE c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
GROUP BY c.name, bucket
HAVING COUNT(*) > 1
ORDER BY c.name, bucket;

-- 2) Campers on inactive vs canonical division rows
SELECT
  c.name AS camp,
  d.name AS division,
  d.is_active,
  public.normalize_division_name_for_filter(d.name) AS bucket,
  COUNT(ch.id) AS active_campers_2026
FROM public.companies c
JOIN public.divisions d ON d.company_id = c.id
LEFT JOIN public.children ch
  ON ch.division_id = d.id
 AND ch.company_id = c.id
 AND ch.season = '2026'
 AND ch.status = 'active'
WHERE c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
GROUP BY c.name, d.name, d.is_active, bucket, d.sort_order
HAVING COUNT(ch.id) > 0
ORDER BY c.name, bucket, d.is_active DESC, d.name;

-- 3) Total medication logs per camp (any division)
SELECT
  c.name AS camp,
  ml.season,
  COUNT(*) AS medication_log_rows,
  COUNT(DISTINCT ml.child_id) AS unique_children
FROM public.companies c
JOIN public.medication_logs ml ON ml.company_id = c.id
WHERE c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
GROUP BY c.name, ml.season
ORDER BY c.name, ml.season DESC;
