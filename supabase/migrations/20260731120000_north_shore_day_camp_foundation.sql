-- Phase 1: North Shore Day Camp foundation
-- Adds camp_type, creates North Shore company, Nursery Campers division, role permissions.

-- 1) camp_type on companies
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS camp_type text NOT NULL DEFAULT 'overnight';

ALTER TABLE public.companies
  DROP CONSTRAINT IF EXISTS companies_camp_type_check;

ALTER TABLE public.companies
  ADD CONSTRAINT companies_camp_type_check
  CHECK (camp_type IN ('overnight', 'day_camp'));

COMMENT ON COLUMN public.companies.camp_type IS
  'overnight = Tyler Hill / Timber Lake camps; day_camp = day camp experience (CampHub-style UI).';

-- Existing camps stay overnight
UPDATE public.companies
SET camp_type = 'overnight'
WHERE camp_type IS NULL OR camp_type = 'overnight';

-- 2) North Shore Day Camp
INSERT INTO public.companies (name, slug, theme_color, is_active, zip_code, camp_type, owl_pay_enabled)
VALUES (
  'North Shore Day Camp',
  'north-shore-day-camp',
  '#1565C0',
  true,
  '11542',
  'day_camp',
  false
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  theme_color = EXCLUDED.theme_color,
  is_active = EXCLUDED.is_active,
  zip_code = EXCLUDED.zip_code,
  camp_type = EXCLUDED.camp_type,
  owl_pay_enabled = EXCLUDED.owl_pay_enabled;

DO $$
DECLARE
  ns_company_id uuid;
BEGIN
  SELECT id INTO ns_company_id FROM public.companies WHERE slug = 'north-shore-day-camp';

  IF ns_company_id IS NULL THEN
    RAISE EXCEPTION 'North Shore Day Camp company not found after insert';
  END IF;

  -- 3) Divisions — Nursery Campers required for Sunshine Report; more from Todd API later
  IF NOT EXISTS (
    SELECT 1 FROM public.divisions
    WHERE company_id = ns_company_id AND name = 'Nursery Campers'
  ) THEN
    INSERT INTO public.divisions (company_id, name, gender, is_active, sort_order)
    VALUES (ns_company_id, 'Nursery Campers', 'Coed', true, 1);
  END IF;

  -- 4) Role permissions — day camp carryover + future day-camp menu IDs
  -- Admin
  INSERT INTO public.role_permissions (company_id, role, menu_item, can_access) VALUES
    (ns_company_id, 'admin', 'activities', true),
    (ns_company_id, 'admin', 'admin', true),
    (ns_company_id, 'admin', 'appointments', true),
    (ns_company_id, 'admin', 'calendar', true),
    (ns_company_id, 'admin', 'dashboard', true),
    (ns_company_id, 'admin', 'division-permissions', true),
    (ns_company_id, 'admin', 'evaluation-questions', true),
    (ns_company_id, 'admin', 'health-center', true),
    (ns_company_id, 'admin', 'incidents', true),
    (ns_company_id, 'admin', 'menu', true),
    (ns_company_id, 'admin', 'messages', true),
    (ns_company_id, 'admin', 'notes', true),
    (ns_company_id, 'admin', 'office-changes', true),
    (ns_company_id, 'admin', 'parent-portal', true),
    (ns_company_id, 'admin', 'rainy-day', true),
    (ns_company_id, 'admin', 'reports', true),
    (ns_company_id, 'admin', 'role-permissions', true),
    (ns_company_id, 'admin', 'roster', true),
    (ns_company_id, 'admin', 'special-events', true),
    (ns_company_id, 'admin', 'staff', true),
    (ns_company_id, 'admin', 'sunshine-report', true),
    (ns_company_id, 'admin', 'swim-bracelets', true),
    (ns_company_id, 'admin', 'swim-progress', true),
    (ns_company_id, 'admin', 'transportation', true),
    (ns_company_id, 'admin', 'user-approvals', true),
    (ns_company_id, 'admin', 'od-management', false),
    (ns_company_id, 'admin', 'owl-pay', false),
    (ns_company_id, 'admin', 'nurse', false)
  ON CONFLICT (company_id, role, menu_item) DO UPDATE SET can_access = EXCLUDED.can_access;

  -- Staff
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
    (ns_company_id, 'staff', 'od-management', false),
    (ns_company_id, 'staff', 'nurse', false)
  ON CONFLICT (company_id, role, menu_item) DO UPDATE SET can_access = EXCLUDED.can_access;

  -- Division leader
  INSERT INTO public.role_permissions (company_id, role, menu_item, can_access) VALUES
    (ns_company_id, 'division_leader', 'activities', true),
    (ns_company_id, 'division_leader', 'calendar', true),
    (ns_company_id, 'division_leader', 'dashboard', true),
    (ns_company_id, 'division_leader', 'health-center', true),
    (ns_company_id, 'division_leader', 'incidents', true),
    (ns_company_id, 'division_leader', 'menu', true),
    (ns_company_id, 'division_leader', 'messages', true),
    (ns_company_id, 'division_leader', 'notes', true),
    (ns_company_id, 'division_leader', 'rainy-day', true),
    (ns_company_id, 'division_leader', 'roster', true),
    (ns_company_id, 'division_leader', 'staff', true),
    (ns_company_id, 'division_leader', 'special-events', true),
    (ns_company_id, 'division_leader', 'sunshine-report', true),
    (ns_company_id, 'division_leader', 'swim-progress', true),
    (ns_company_id, 'division_leader', 'transportation', true),
    (ns_company_id, 'division_leader', 'od-management', false),
    (ns_company_id, 'division_leader', 'nurse', false)
  ON CONFLICT (company_id, role, menu_item) DO UPDATE SET can_access = EXCLUDED.can_access;

  -- Health center (day camp)
  INSERT INTO public.role_permissions (company_id, role, menu_item, can_access) VALUES
    (ns_company_id, 'health_center', 'dashboard', true),
    (ns_company_id, 'health_center', 'health-center', true),
    (ns_company_id, 'health_center', 'roster', true),
    (ns_company_id, 'health_center', 'incidents', true),
    (ns_company_id, 'health_center', 'appointments', true),
    (ns_company_id, 'health_center', 'calendar', true),
    (ns_company_id, 'health_center', 'messages', true),
    (ns_company_id, 'health_center', 'transportation', true),
    (ns_company_id, 'health_center', 'admin', false),
    (ns_company_id, 'health_center', 'nurse', false),
    (ns_company_id, 'health_center', 'od-management', false)
  ON CONFLICT (company_id, role, menu_item) DO UPDATE SET can_access = EXCLUDED.can_access;

END $$;
