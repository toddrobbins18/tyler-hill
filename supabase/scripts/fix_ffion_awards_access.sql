-- Run once in Supabase SQL Editor (safe to re-run).
-- Fixes division leaders (e.g. ffionmiddleton99@gmail.com / Super Girls) seeing 0 awards
-- while Tyler Hill admin sees the full list.
--
-- Prerequisite: run fix_division_leader_roster_access.sql once if
-- normalize_division_name_for_filter / canonical_division_id_for_bucket are missing.
-- Also run fix_division_leader_awards_access.sql if awards RLS/menu was never applied.

-- 1) Awards page permission for division_leader
INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT c.id, r.role, 'awards', true
FROM public.companies c
CROSS JOIN unnest(ARRAY[
  'admin',
  'staff',
  'health_center',
  'division_leader',
  'specialist',
  'viewer'
]::public.app_role[]) AS r(role)
WHERE COALESCE(c.is_active, true) = true
ON CONFLICT (company_id, role, menu_item)
DO UPDATE SET can_access = true;

-- 2) Super Girls division permission for Ffion (canonical bucket)
INSERT INTO public.division_permissions (user_id, division_id, company_id, can_access)
SELECT
  u.id,
  d.id,
  d.company_id,
  true
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
JOIN public.divisions d
  ON d.company_id = p.company_id
 AND d.is_active = true
 AND public.normalize_division_name_for_filter(d.name) = 'super girls'
WHERE lower(trim(u.email)) = 'ffionmiddleton99@gmail.com'
ON CONFLICT (user_id, division_id)
DO UPDATE SET can_access = true, company_id = EXCLUDED.company_id;

-- 3) Repoint Ffion's staff row to canonical Super Girls (if still on alias)
UPDATE public.staff s
SET division_id = public.canonical_division_id_for_bucket(s.company_id, 'super girls')
WHERE EXISTS (
  SELECT 1
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  JOIN public.divisions staff_div ON staff_div.id = s.division_id
  WHERE lower(trim(u.email)) = 'ffionmiddleton99@gmail.com'
    AND s.company_id = p.company_id
    AND lower(trim(COALESCE(s.email, ''))) = lower(trim(u.email))
    AND COALESCE(s.status, 'active') = 'active'
    AND public.normalize_division_name_for_filter(staff_div.name) = 'super girls'
)
AND public.canonical_division_id_for_bucket(s.company_id, 'super girls') IS NOT NULL
AND s.division_id IS DISTINCT FROM public.canonical_division_id_for_bucket(s.company_id, 'super girls');

-- 4) Audit — expect campers_visible_via_rls > 0 and awards_visible > 0
SELECT
  u.email,
  co.name AS company_name,
  ur.role,
  (
    SELECT string_agg(DISTINCT d.name, ', ' ORDER BY d.name)
    FROM public.division_permissions dp
    JOIN public.divisions d ON d.id = dp.division_id
    WHERE dp.user_id = u.id AND dp.can_access = true
  ) AS permitted_division_names,
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
    FROM public.awards a
    JOIN public.children ch ON ch.id = a.child_id
    WHERE a.company_id = p.company_id
      AND ch.division_id = ANY(COALESCE(public.get_user_divisions(u.id), ARRAY[]::uuid[]))
  ) AS awards_for_accessible_divisions
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.companies co ON co.id = p.company_id
LEFT JOIN public.user_roles ur ON ur.user_id = u.id AND ur.company_id = p.company_id
WHERE lower(trim(u.email)) = 'ffionmiddleton99@gmail.com';
