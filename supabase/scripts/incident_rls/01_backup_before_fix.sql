-- =============================================================================
-- STEP 1 of 4 — BACKUP (run FIRST, before any changes)
-- Supabase → SQL Editor → run this entire file
-- Copy/save ALL results somewhere safe (Notes, Google Doc, file on disk)
-- You need this output for rollback if anything goes wrong
-- =============================================================================

-- 1A) Current incident RLS policies
SELECT
  'POLICY' AS backup_type,
  tablename,
  policyname,
  cmd,
  qual AS using_expression,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('incident_reports', 'incident_children')
ORDER BY tablename, policyname;

-- 1B) Current incident helper function definitions
SELECT pg_get_functiondef(p.oid) AS function_definition
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'user_matches_role_at_company',
    'user_has_incidents_page_access',
    'user_can_manage_incidents',
    'user_can_view_all_company_incidents',
    'user_can_create_incident_reports',
    'incident_has_accessible_child',
    'can_insert_incident_child',
    'can_view_incident_children',
    'can_manage_incident_children'
  )
ORDER BY p.proname;

-- 1C) Current incidents menu permissions (all camps)
SELECT
  c.slug AS camp_slug,
  rp.role,
  rp.can_access AS incidents_menu
FROM public.role_permissions rp
JOIN public.companies c ON c.id = rp.company_id
WHERE rp.menu_item = 'incidents'
ORDER BY c.slug, rp.role;

-- 1D) Tyler Hill baseline — who can create incidents RIGHT NOW
SELECT
  p.email,
  p.full_name,
  p.role AS profile_role,
  ur.role AS user_roles_role
FROM public.profiles p
JOIN public.companies c ON c.id = p.company_id
LEFT JOIN public.user_roles ur ON ur.user_id = p.id AND ur.company_id = c.id
WHERE c.slug = 'tyler-hill-camp'
  AND COALESCE(p.approved, true) = true
ORDER BY p.role, p.email;

-- Save the row counts / results above. Then proceed to STEP 2.
