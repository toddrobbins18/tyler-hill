-- Diagnose Teen Boys roster access for hardylilly234@gmail.com
-- Run in Supabase SQL Editor. Read-only.

-- =============================================================================
-- PART 1: User permissions summary
-- =============================================================================
WITH target AS (
  SELECT id AS user_id, email
  FROM auth.users
  WHERE lower(trim(email)) = 'hardylilly234@gmail.com'
  LIMIT 1
)
SELECT
  t.email,
  ur.role,
  p.company_id,
  public.get_user_divisions(t.user_id) AS rls_division_ids,
  (
    SELECT json_agg(json_build_object('division_id', dp.division_id, 'name', d.name, 'can_access', dp.can_access))
    FROM public.division_permissions dp
    JOIN public.divisions d ON d.id = dp.division_id
    WHERE dp.user_id = t.user_id
      AND dp.can_access = true
  ) AS division_permissions,
  (
    SELECT json_agg(json_build_object('division_id', s.division_id, 'division_name', d.name, 'season', s.season))
    FROM public.staff s
    LEFT JOIN public.divisions d ON d.id = s.division_id
    WHERE lower(trim(s.email)) = lower(trim(t.email))
  ) AS staff_divisions,
  (
    SELECT count(*)
    FROM public.children c
    WHERE c.company_id = p.company_id
      AND c.season = '2026'
      AND COALESCE(c.status, 'active') <> 'inactive'
      AND c.division_id = ANY(COALESCE(public.get_user_divisions(t.user_id), ARRAY[]::uuid[]))
  ) AS teen_boys_campers_visible_via_rls
FROM target t
JOIN public.profiles p ON p.id = t.user_id
LEFT JOIN public.user_roles ur ON ur.user_id = t.user_id;

-- Quick proof of the whitespace bug (run BEFORE migration — expect mismatched norms):
-- SELECT public.normalize_division_name_for_filter('Teen Boys') AS teen_boys,
--        public.normalize_division_name_for_filter('Teen TN1 Boys') AS teen_tn1_boys;
-- After migration both should be 'teen boys'.

-- =============================================================================
-- PART 2: Where Teen Boys campers actually live vs what RLS allows (THE SMOKING GUN)
-- =============================================================================
WITH target AS (
  SELECT u.id AS user_id, p.company_id
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  WHERE lower(trim(u.email)) = 'hardylilly234@gmail.com'
  LIMIT 1
),
allowed AS (
  SELECT unnest(COALESCE(public.get_user_divisions((SELECT user_id FROM target)), ARRAY[]::uuid[])) AS division_id
)
SELECT
  d.id AS division_id,
  d.name AS division_name,
  d.is_active,
  public.normalize_division_name_for_filter(d.name) AS normalized_name,
  count(c.id) AS camper_count_2026,
  EXISTS (SELECT 1 FROM allowed a WHERE a.division_id = d.id) AS allowed_by_rls
FROM public.divisions d
LEFT JOIN public.children c
  ON c.division_id = d.id
 AND c.company_id = (SELECT company_id FROM target)
 AND c.season = '2026'
 AND COALESCE(c.status, 'active') <> 'inactive'
WHERE d.company_id = (SELECT company_id FROM target)
  AND public.normalize_division_name_for_filter(d.name) = 'teen boys'
GROUP BY d.id, d.name, d.is_active
ORDER BY camper_count_2026 DESC, d.is_active DESC, d.name;
