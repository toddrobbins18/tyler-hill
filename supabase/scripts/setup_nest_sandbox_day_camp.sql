-- Nest training sandbox — day camp shell (no CampMinder, no real PII).
-- Xerox of North Shore role permissions + one placeholder division.
-- Run in Supabase SQL Editor after North Shore foundation exists.
-- Safe to re-run.
-- Next: seed_nest_sandbox_demo_data.sql (50 fake campers + transport board for season 2027).

INSERT INTO public.companies (
  name,
  slug,
  theme_color,
  is_active,
  zip_code,
  camp_type,
  owl_pay_enabled,
  campminder_sync_enabled
)
VALUES (
  'Nest Training Sandbox',
  'nest-sandbox-day-camp',
  '#0D9488',
  true,
  '11050',
  'day_camp',
  false,
  false
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  theme_color = EXCLUDED.theme_color,
  is_active = EXCLUDED.is_active,
  zip_code = EXCLUDED.zip_code,
  camp_type = EXCLUDED.camp_type,
  owl_pay_enabled = EXCLUDED.owl_pay_enabled,
  campminder_sync_enabled = EXCLUDED.campminder_sync_enabled;

DO $$
DECLARE
  ns_id uuid;
  sb_id uuid;
BEGIN
  SELECT id INTO ns_id FROM public.companies WHERE slug = 'north-shore-day-camp';
  SELECT id INTO sb_id FROM public.companies WHERE slug = 'nest-sandbox-day-camp';

  IF ns_id IS NULL THEN
    RAISE EXCEPTION 'Run setup_north_shore_day_camp_foundation.sql first';
  END IF;
  IF sb_id IS NULL THEN
    RAISE EXCEPTION 'Sandbox company insert failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.divisions
    WHERE company_id = sb_id AND name = 'Demo Division'
  ) THEN
    INSERT INTO public.divisions (company_id, name, gender, is_active, sort_order)
    VALUES (sb_id, 'Demo Division', 'Coed', true, 1);
  END IF;

  -- Full permission xerox from North Shore (all roles / menu items).
  INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
  SELECT sb_id, rp.role, rp.menu_item, rp.can_access
  FROM public.role_permissions rp
  WHERE rp.company_id = ns_id
  ON CONFLICT (company_id, role, menu_item) DO UPDATE
  SET can_access = EXCLUDED.can_access;

  -- Extra POC items that may exist on NS from later phase scripts but not in foundation.
  INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
  SELECT sb_id, rp.role, rp.menu_item, rp.can_access
  FROM public.role_permissions rp
  WHERE rp.company_id = ns_id
    AND rp.menu_item IN (
      'front-office', 'transport-admin', 'bunking', 'hiring', 'media',
      'swim-lessons', 'bus-attendance', 'bus-check-ins', 'group-bubble-sheets',
      'change-sheets', 'pending-transport-changes', 'nurse', 'tutoring-therapy',
      'staff-time-clock', 'specialist-sport-assignments'
    )
  ON CONFLICT (company_id, role, menu_item) DO UPDATE
  SET can_access = EXCLUDED.can_access;

END $$;

-- Verify
SELECT id, name, slug, camp_type, campminder_sync_enabled, is_active
FROM public.companies
WHERE slug = 'nest-sandbox-day-camp';

SELECT COUNT(*) AS sandbox_permission_rows
FROM public.role_permissions rp
JOIN public.companies c ON c.id = rp.company_id
WHERE c.slug = 'nest-sandbox-day-camp';

SELECT COUNT(*) AS ns_permission_rows
FROM public.role_permissions rp
JOIN public.companies c ON c.id = rp.company_id
WHERE c.slug = 'north-shore-day-camp';
