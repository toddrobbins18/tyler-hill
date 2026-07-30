-- Phase 3.5 — Admin (panel, roles, divisions) on North Shore Day Camp
-- Run in Supabase SQL Editor after setup_north_shore_day_camp_foundation.sql
-- Safe to re-run.

DO $$
DECLARE
  ns_company_id uuid;
BEGIN
  SELECT id INTO ns_company_id FROM public.companies WHERE slug = 'north-shore-day-camp';

  IF ns_company_id IS NULL THEN
    RAISE EXCEPTION 'North Shore Day Camp not found — run setup_north_shore_day_camp_foundation.sql first';
  END IF;

  -- Specialist sport assignments in day-camp role-permissions UI but missing from foundation seed
  INSERT INTO public.role_permissions (company_id, role, menu_item, can_access) VALUES
    (ns_company_id, 'admin', 'specialist-sport-assignments', true)
  ON CONFLICT (company_id, role, menu_item) DO UPDATE SET can_access = EXCLUDED.can_access;

END $$;

-- Verify Phase 3.5 admin menu permissions
SELECT
  rp.role,
  rp.menu_item,
  rp.can_access
FROM public.role_permissions rp
JOIN public.companies c ON c.id = rp.company_id
WHERE c.slug = 'north-shore-day-camp'
  AND rp.menu_item IN (
    'admin',
    'evaluation-questions',
    'role-permissions',
    'division-permissions',
    'specialist-sport-assignments',
    'user-approvals'
  )
ORDER BY rp.menu_item, rp.role;

-- Admin users assigned to North Shore (assign via user_roles if empty)
SELECT ur.user_id, p.full_name, p.email, ur.role
FROM public.user_roles ur
JOIN public.companies c ON c.id = ur.company_id
LEFT JOIN public.profiles p ON p.id = ur.user_id
WHERE c.slug = 'north-shore-day-camp'
  AND ur.role IN ('admin', 'super_admin')
ORDER BY p.full_name;

-- Division permissions rows (empty until admins assign division leaders)
SELECT COUNT(*) AS division_permission_rows
FROM public.division_permissions dp
JOIN public.companies c ON c.id = dp.company_id
WHERE c.slug = 'north-shore-day-camp';
