-- Staff roster counts by camp + season (2027 focus)
-- Use when UI shows too many staff (rollover copies not inactivated after CM sync).

SELECT
  c.slug,
  c.name AS camp,
  s.season,
  COUNT(*) FILTER (
    WHERE COALESCE(LOWER(s.status), 'active') NOT IN ('inactive')
  ) AS nest_active,
  COUNT(*) FILTER (
    WHERE LOWER(COALESCE(s.status, '')) = 'inactive'
  ) AS nest_inactive,
  COUNT(*) AS nest_total
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west', 'north-shore-day-camp')
  AND s.season IN ('2026', '2027')
GROUP BY c.slug, c.name, s.season
ORDER BY c.name, s.season;

-- Latest CM sync staff count vs Nest active (2027)
SELECT DISTINCT ON (c.slug)
  c.name AS camp,
  c.slug,
  j.created_at AS last_sync_at,
  j.status AS sync_status,
  j.total_counts->>'staff' AS cm_active_staff,
  j.total_counts->>'staff_inactivated' AS staff_inactivated,
  (
    SELECT COUNT(*)::text
    FROM public.staff s
    WHERE s.company_id = c.id
      AND s.season = '2027'
      AND COALESCE(LOWER(s.status), 'active') NOT IN ('inactive')
  ) AS nest_active_2027
FROM public.sync_jobs j
JOIN public.companies c ON c.id = j.company_id
WHERE j.entity_type = 'campminder'
  AND c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
  AND (j.progress->>'season' = '2027' OR j.total_counts IS NOT NULL)
ORDER BY c.slug, j.created_at DESC;
