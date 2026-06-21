-- Permissions audit for hardylilly234@gmail.com (read-only)
-- Run the whole script in Supabase SQL Editor.

-- 1) Profile + company
SELECT
  '1_profile' AS section,
  u.email,
  p.full_name,
  p.role AS profile_role,
  p.approved,
  p.company_id,
  co.name AS company_name,
  co.slug AS company_slug
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.companies co ON co.id = p.company_id
WHERE lower(trim(u.email)) = 'hardylilly234@gmail.com';

-- 2) App roles (user_roles)
SELECT
  '2_user_roles' AS section,
  u.email,
  ur.role,
  ur.company_id,
  co.name AS company_name
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
LEFT JOIN public.companies co ON co.id = ur.company_id
WHERE lower(trim(u.email)) = 'hardylilly234@gmail.com'
ORDER BY ur.role;

-- 3) Division permissions
SELECT
  '3_division_permissions' AS section,
  u.email,
  dp.can_access,
  dp.company_id,
  co.name AS company_name,
  dp.division_id,
  d.name AS division_name,
  d.is_active AS division_active,
  public.normalize_division_name_for_filter(d.name) AS normalized_name
FROM auth.users u
JOIN public.division_permissions dp ON dp.user_id = u.id
JOIN public.divisions d ON d.id = dp.division_id
LEFT JOIN public.companies co ON co.id = dp.company_id
WHERE lower(trim(u.email)) = 'hardylilly234@gmail.com'
ORDER BY co.name, d.sort_order, d.name;

-- 4) Expanded division IDs used by RLS
SELECT
  '4_rls_division_ids' AS section,
  u.email,
  public.get_user_divisions(u.id) AS rls_division_ids
FROM auth.users u
WHERE lower(trim(u.email)) = 'hardylilly234@gmail.com';

-- 5) Staff record + assigned division
SELECT
  '5_staff_divisions' AS section,
  u.email,
  s.id AS staff_id,
  s.name AS staff_name,
  s.season,
  s.status,
  s.division_id,
  d.name AS staff_division_name,
  d.is_active AS division_active
FROM auth.users u
JOIN public.staff s
  ON lower(trim(COALESCE(s.email, ''))) = lower(trim(u.email))
LEFT JOIN public.divisions d ON d.id = s.division_id
WHERE lower(trim(u.email)) = 'hardylilly234@gmail.com'
ORDER BY s.season DESC;

-- 6) Page/menu permissions (role_permissions)
SELECT
  '6_page_permissions' AS section,
  u.email,
  ur.role,
  rp.company_id,
  co.name AS company_name,
  rp.menu_item,
  rp.can_access
FROM auth.users u
JOIN public.user_roles ur ON ur.user_id = u.id
JOIN public.role_permissions rp ON rp.role = ur.role
LEFT JOIN public.companies co ON co.id = rp.company_id
WHERE lower(trim(u.email)) = 'hardylilly234@gmail.com'
  AND rp.can_access = true
ORDER BY co.name, rp.menu_item;

-- 7) Camper access summary (2026)
SELECT
  '7_camper_access' AS section,
  u.email,
  p.company_id,
  co.name AS company_name,
  (
    SELECT count(*)
    FROM public.children ch
    WHERE ch.company_id = p.company_id
      AND ch.season = '2026'
      AND COALESCE(ch.status, 'active') <> 'inactive'
      AND ch.division_id = ANY(COALESCE(public.get_user_divisions(u.id), ARRAY[]::uuid[]))
  ) AS campers_visible_via_rls,
  (
    SELECT count(*)
    FROM public.children ch
    JOIN public.divisions d ON d.id = ch.division_id
    WHERE ch.company_id = p.company_id
      AND ch.season = '2026'
      AND COALESCE(ch.status, 'active') <> 'inactive'
      AND public.normalize_division_name_for_filter(d.name) = 'teen boys'
  ) AS total_teen_boys_campers_in_db
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.companies co ON co.id = p.company_id
WHERE lower(trim(u.email)) = 'hardylilly234@gmail.com';

-- 8) Teen Boys breakdown
SELECT
  '8_teen_boys_breakdown' AS section,
  d.id AS division_id,
  d.name AS division_name,
  d.is_active,
  count(ch.id) AS camper_count_2026,
  d.id = ANY(COALESCE(public.get_user_divisions(u.id), ARRAY[]::uuid[])) AS allowed_by_rls
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
JOIN public.divisions d ON d.company_id = p.company_id
LEFT JOIN public.children ch
  ON ch.division_id = d.id
 AND ch.company_id = p.company_id
 AND ch.season = '2026'
 AND COALESCE(ch.status, 'active') <> 'inactive'
WHERE lower(trim(u.email)) = 'hardylilly234@gmail.com'
  AND public.normalize_division_name_for_filter(d.name) = 'teen boys'
GROUP BY u.id, d.id, d.name, d.is_active
ORDER BY camper_count_2026 DESC, d.name;
