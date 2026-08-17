-- Tyler Hill — Health Center admissions report (full detail + summary)
-- Run in Supabase SQL Editor → Export CSV
-- Change season below if needed.

WITH camp AS (
  SELECT id AS company_id, name AS camp_name
  FROM public.companies
  WHERE slug = 'tyler-hill-camp'
  LIMIT 1
),
admissions AS (
  SELECT
    hca.id AS admission_id,
    hca.admitted_at,
    hca.checked_out_at,
    hca.season,
    hca.visit_type,
    hca.reason,
    hca.notes,
    hca.child_id,
    hca.staff_id,
    c.person_id AS camper_person_id,
    COALESCE(c.name, s.name) AS person_name,
    CASE
      WHEN hca.child_id IS NOT NULL THEN 'camper'
      WHEN hca.staff_id IS NOT NULL THEN 'staff'
      ELSE 'unknown'
    END AS person_type,
    d.name AS division,
    s.role AS staff_role,
    p_admit.full_name AS admitted_by_name,
    p_checkout.full_name AS checked_out_by_name,
    CASE
      WHEN hca.checked_out_at IS NOT NULL THEN
        ROUND(EXTRACT(EPOCH FROM (hca.checked_out_at - hca.admitted_at)) / 3600.0, 2)
      ELSE NULL
    END AS hours_in_health_center
  FROM public.health_center_admissions hca
  JOIN camp ON hca.company_id = camp.company_id
  LEFT JOIN public.children c ON c.id = hca.child_id
  LEFT JOIN public.staff s ON s.id = hca.staff_id
  LEFT JOIN public.divisions d ON d.id = c.division_id
  LEFT JOIN public.profiles p_admit ON p_admit.id = hca.admitted_by
  LEFT JOIN public.profiles p_checkout ON p_checkout.id = hca.checked_out_by
  WHERE hca.season = '2026'
)
SELECT *
FROM (
  SELECT
    0 AS _sort,
    'TOTALS' AS admission_id,
    NULL::timestamptz AS admitted_at,
    NULL::timestamptz AS checked_out_at,
    season,
    NULL::text AS visit_type,
    NULL::text AS reason,
    NULL::text AS notes,
    NULL::uuid AS child_id,
    NULL::uuid AS staff_id,
    NULL::text AS camper_person_id,
    NULL::text AS person_name,
    NULL::text AS person_type,
    NULL::text AS division,
    NULL::text AS staff_role,
    NULL::text AS admitted_by_name,
    NULL::text AS checked_out_by_name,
    NULL::numeric AS hours_in_health_center,
    COUNT(*)::text AS total_admissions,
    COUNT(DISTINCT child_id) FILTER (WHERE child_id IS NOT NULL)::text AS unique_campers,
    COUNT(DISTINCT staff_id) FILTER (WHERE staff_id IS NOT NULL)::text AS unique_staff
  FROM admissions
  GROUP BY season

  UNION ALL

  SELECT
    1 AS _sort,
    admission_id::text,
    admitted_at,
    checked_out_at,
    season,
    visit_type,
    reason,
    notes,
    child_id,
    staff_id,
    camper_person_id,
    person_name,
    person_type,
    division,
    staff_role,
    admitted_by_name,
    checked_out_by_name,
    hours_in_health_center,
    NULL::text,
    NULL::text,
    NULL::text
  FROM admissions
) report
ORDER BY
  _sort,
  admitted_at ASC NULLS FIRST,
  person_name ASC NULLS LAST;
