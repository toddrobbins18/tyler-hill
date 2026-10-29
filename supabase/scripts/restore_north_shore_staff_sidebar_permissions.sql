-- Restore North Shore Day Camp "staff" role sidebar defaults (Role Permissions matrix).
-- Run in Supabase SQL Editor if staff users only see Swim / Health Center / Parent Portal on mobile or web.

DO $$
DECLARE
  ns_company_id uuid;
BEGIN
  SELECT id INTO ns_company_id FROM public.companies WHERE slug = 'north-shore-day-camp';
  IF ns_company_id IS NULL THEN
    RAISE EXCEPTION 'North Shore Day Camp company not found';
  END IF;

  INSERT INTO public.role_permissions (company_id, role, menu_item, can_access) VALUES
    (ns_company_id, 'staff', 'activities', true),
    (ns_company_id, 'staff', 'admin', false),
    (ns_company_id, 'staff', 'appointments', true),
    (ns_company_id, 'staff', 'calendar', true),
    (ns_company_id, 'staff', 'dashboard', true),
    (ns_company_id, 'staff', 'health-center', true),
    (ns_company_id, 'staff', 'incidents', true),
    (ns_company_id, 'staff', 'menu', true),
    (ns_company_id, 'staff', 'messages', true),
    (ns_company_id, 'staff', 'notes', true),
    (ns_company_id, 'staff', 'office-changes', true),
    (ns_company_id, 'staff', 'rainy-day', true),
    (ns_company_id, 'staff', 'reports', true),
    (ns_company_id, 'staff', 'roster', true),
    (ns_company_id, 'staff', 'special-events', true),
    (ns_company_id, 'staff', 'staff', false),
    (ns_company_id, 'staff', 'sunshine-report', true),
    (ns_company_id, 'staff', 'swim-bracelets', true),
    (ns_company_id, 'staff', 'swim-progress', true),
    (ns_company_id, 'staff', 'transportation', true),
    (ns_company_id, 'staff', 'bunking', true),
    (ns_company_id, 'staff', 'hiring', true),
    (ns_company_id, 'staff', 'front-office', true),
    (ns_company_id, 'staff', 'swim-lessons', true),
    (ns_company_id, 'staff', 'swim', true),
    (ns_company_id, 'staff', 'tutoring-therapy', true),
    (ns_company_id, 'staff', 'staff-time-clock', true),
    (ns_company_id, 'staff', 'parent-portal', false)
  ON CONFLICT (company_id, role, menu_item) DO UPDATE SET can_access = EXCLUDED.can_access;
END $$;
