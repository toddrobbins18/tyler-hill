-- =============================================================================
-- STEP 3 of 4 — VERIFY (run AFTER Step 2 succeeds)
-- All checks should match the "EXPECTED" notes below
-- =============================================================================

-- 3A) Policies installed
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('incident_reports', 'incident_children')
ORDER BY tablename, policyname;
-- EXPECTED: incident_reports_select, insert, update, delete + incident_children_*

-- 3B) Menu permissions at Tyler Hill
SELECT rp.role, rp.can_access AS incidents_menu
FROM public.role_permissions rp
JOIN public.companies c ON c.id = rp.company_id
WHERE c.slug = 'tyler-hill-camp'
  AND rp.menu_item = 'incidents'
ORDER BY rp.role;
-- EXPECTED: admin=true, division_leader=true, viewer=true, staff=false

-- 3C) Tyler Hill ADMINS — must ALL pass
SELECT
  p.email,
  p.full_name,
  p.role AS profile_role,
  ur.role AS login_role,
  public.user_can_view_all_company_incidents(p.id, c.id) AS can_view_all,
  public.user_can_manage_incidents(p.id, c.id) AS can_manage,
  public.user_can_create_incident_reports(p.id, c.id) AS can_create
FROM public.profiles p
JOIN public.companies c ON c.id = p.company_id
LEFT JOIN public.user_roles ur ON ur.user_id = p.id AND ur.company_id = c.id
WHERE c.slug = 'tyler-hill-camp'
  AND p.role = 'admin'
ORDER BY p.email;
-- EXPECTED: can_view_all=true, can_manage=true, can_create=true for every admin

-- 3D) Tyler Hill STAFF — must ALL be blocked
SELECT
  p.email,
  p.full_name,
  public.user_has_incidents_page_access(p.id, c.id) AS has_menu,
  public.user_can_create_incident_reports(p.id, c.id) AS can_create,
  public.user_can_view_all_company_incidents(p.id, c.id) AS can_view_all
FROM public.profiles p
JOIN public.companies c ON c.id = p.company_id
WHERE c.slug = 'tyler-hill-camp'
  AND p.role = 'staff'
  AND (
    public.user_has_incidents_page_access(p.id, c.id)
    OR public.user_can_create_incident_reports(p.id, c.id)
    OR public.user_can_view_all_company_incidents(p.id, c.id)
  )
ORDER BY p.email;
-- EXPECTED: 0 rows (empty result)

-- 3E) Tyler Hill DIVISION LEADERS — scoped access
SELECT
  p.email,
  p.full_name,
  p.role AS profile_role,
  ur.role AS login_role,
  public.user_has_incidents_page_access(p.id, c.id) AS has_menu,
  public.user_can_create_incident_reports(p.id, c.id) AS can_create,
  public.user_can_view_all_company_incidents(p.id, c.id) AS can_view_all,
  public.user_can_manage_incidents(p.id, c.id) AS can_manage
FROM public.profiles p
JOIN public.companies c ON c.id = p.company_id
LEFT JOIN public.user_roles ur ON ur.user_id = p.id AND ur.company_id = c.id
WHERE c.slug = 'tyler-hill-camp'
  AND p.role IN ('division_leader', 'viewer')
ORDER BY p.email;
-- EXPECTED: has_menu=true, can_create=true, can_view_all=false, can_manage=false

-- 3F) Deanna & Landon specifically
SELECT
  p.full_name,
  p.email,
  p.role AS profile_role,
  ur.role AS login_role,
  CASE
    WHEN ur.id IS NULL THEN 'MISSING user_roles'
    WHEN ur.company_id IS DISTINCT FROM c.id THEN 'WRONG company'
    WHEN ur.role::text IS DISTINCT FROM p.role THEN 'ROLE MISMATCH'
    ELSE 'OK'
  END AS account_status,
  public.user_has_incidents_page_access(p.id, c.id) AS has_menu,
  public.user_can_create_incident_reports(p.id, c.id) AS can_create,
  public.user_can_view_all_company_incidents(p.id, c.id) AS can_view_all,
  public.user_can_manage_incidents(p.id, c.id) AS can_manage
FROM public.profiles p
JOIN public.companies c ON c.id = p.company_id
LEFT JOIN public.user_roles ur ON ur.user_id = p.id AND ur.company_id = c.id
WHERE c.slug = 'tyler-hill-camp'
  AND (
    p.full_name ILIKE '%Deanna%'
    OR p.full_name ILIKE '%Landon%'
    OR p.email ILIKE '%deanna%'
    OR p.email ILIKE '%landon%'
  )
ORDER BY p.full_name;
-- EXPECTED by role:
--   Admin     → can_create=true, can_view_all=true, can_manage=true
--   DL/Viewer → can_create=true, can_view_all=false, can_manage=false
--   Staff     → all false (Todd does not want staff on incidents)

-- 3G) Cross-camp blocked (Tyler Hill user cannot create at another camp)
WITH th AS (
  SELECT id FROM public.companies WHERE slug = 'tyler-hill-camp'
),
other AS (
  SELECT id, slug FROM public.companies
  WHERE slug != 'tyler-hill-camp'
  LIMIT 1
)
SELECT
  p.email,
  p.role,
  public.user_can_create_incident_reports(p.id, th.id) AS tyler_hill_ok,
  public.user_can_create_incident_reports(p.id, other.id) AS other_camp_ok,
  (SELECT slug FROM other) AS other_camp_slug
FROM public.profiles p
CROSS JOIN th
CROSS JOIN other
WHERE p.company_id = th.id
  AND p.role IN ('admin', 'division_leader')
LIMIT 10;
-- EXPECTED: tyler_hill_ok=true for admin/DL, other_camp_ok=false

-- 3H) Summary counts
SELECT
  p.role,
  COUNT(*) AS users,
  COUNT(*) FILTER (WHERE public.user_can_create_incident_reports(p.id, c.id)) AS can_create,
  COUNT(*) FILTER (WHERE public.user_can_view_all_company_incidents(p.id, c.id)) AS can_view_all
FROM public.profiles p
JOIN public.companies c ON c.id = p.company_id
WHERE c.slug = 'tyler-hill-camp'
  AND COALESCE(p.approved, true) = true
GROUP BY p.role
ORDER BY p.role;
