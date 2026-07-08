-- Tyler Hill (or any camp): find staff who would fail incident report RLS.
-- Run in Supabase SQL Editor. Replace email in Query 4 to test one user.

-- 1) Tyler Hill company id
SELECT id, name, slug FROM public.companies WHERE slug = 'tyler-hill-camp';

-- 2) Staff at Tyler Hill missing user_roles row (common cause of RLS errors)
SELECT
  p.id AS user_id,
  p.email,
  p.full_name,
  p.role AS profile_role,
  p.company_id AS profile_company_id
FROM public.profiles p
JOIN public.companies c ON c.id = p.company_id
WHERE c.slug = 'tyler-hill-camp'
  AND COALESCE(p.approved, true) = true
  AND p.role IN ('staff', 'health_center', 'division_leader', 'specialist', 'viewer', 'admin')
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p.id
      AND ur.company_id = c.id
  )
ORDER BY p.email;

-- 3) Tyler Hill roles missing Incidents menu permission
SELECT rp.role, rp.can_access
FROM public.role_permissions rp
JOIN public.companies c ON c.id = rp.company_id
WHERE c.slug = 'tyler-hill-camp'
  AND rp.menu_item = 'incidents'
ORDER BY rp.role;

-- 4) Test one user (replace email)
-- Shows which incident RLS checks pass/fail for that user at Tyler Hill.
WITH u AS (
  SELECT p.id AS user_id, c.id AS company_id, p.email, p.role
  FROM public.profiles p
  JOIN public.companies c ON c.id = p.company_id
  WHERE c.slug = 'tyler-hill-camp'
    AND p.email = 'REPLACE_WITH_STAFF_EMAIL@example.com'
  LIMIT 1
)
SELECT
  u.email,
  u.role,
  public.user_has_incidents_page_access(u.user_id, u.company_id) AS has_incidents_menu,
  public.user_can_manage_incidents(u.user_id, u.company_id) AS can_manage,
  public.user_can_view_all_company_incidents(u.user_id, u.company_id) AS can_view_all,
  public.user_can_create_incident_reports(u.user_id, u.company_id) AS can_create,
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = u.user_id AND ur.company_id = u.company_id
  ) AS has_user_roles_row
FROM u;

-- 5) Current incident RLS policies (verify migration applied)
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('incident_reports', 'incident_children')
ORDER BY tablename, policyname;

-- 6) Tyler Hill users with profile role but no matching user_roles (main RLS failure pattern)
SELECT
  p.email,
  p.full_name,
  p.role AS profile_role,
  ur.role AS user_roles_role,
  ur.company_id AS user_roles_company_id
FROM public.profiles p
JOIN public.companies c ON c.id = p.company_id
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
WHERE c.slug = 'tyler-hill-camp'
  AND COALESCE(p.approved, true) = true
  AND p.role IN ('staff', 'health_center', 'division_leader', 'specialist', 'viewer', 'admin')
  AND (
    ur.id IS NULL
    OR ur.company_id IS DISTINCT FROM c.id
    OR ur.role::text IS DISTINCT FROM p.role
  )
ORDER BY p.email;
