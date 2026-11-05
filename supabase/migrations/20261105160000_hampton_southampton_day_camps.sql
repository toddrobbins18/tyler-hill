-- Hampton Country Day Camp + Southampton Camp & Club
-- Company rows and day-camp menu permissions (copied from North Shore).
-- CampMinder credentials are stored encrypted via Company Management / encrypt_secret,
-- not in this migration.

INSERT INTO public.companies (name, slug, theme_color, is_active, zip_code, camp_type, owl_pay_enabled)
VALUES
  (
    'Hampton Country Day Camp',
    'hampton-country-day-camp',
    '#2E7D32',
    true,
    '11932',
    'day_camp',
    false
  ),
  (
    'Southampton Camp & Club',
    'southampton-camp-club',
    '#0277BD',
    true,
    '11968',
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
  hampton_id uuid;
  southampton_id uuid;
BEGIN
  SELECT id INTO ns_company_id FROM public.companies WHERE slug = 'north-shore-day-camp';
  SELECT id INTO hampton_id FROM public.companies WHERE slug = 'hampton-country-day-camp';
  SELECT id INTO southampton_id FROM public.companies WHERE slug = 'southampton-camp-club';

  IF ns_company_id IS NULL THEN
    RAISE EXCEPTION 'north-shore-day-camp not found; copy permissions after North Shore exists';
  END IF;
  IF hampton_id IS NULL OR southampton_id IS NULL THEN
    RAISE EXCEPTION 'Hampton or Southampton company row missing after insert';
  END IF;

  INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
  SELECT hampton_id, role, menu_item, can_access
  FROM public.role_permissions
  WHERE company_id = ns_company_id
  ON CONFLICT (company_id, role, menu_item) DO UPDATE
    SET can_access = EXCLUDED.can_access;

  INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
  SELECT southampton_id, role, menu_item, can_access
  FROM public.role_permissions
  WHERE company_id = ns_company_id
  ON CONFLICT (company_id, role, menu_item) DO UPDATE
    SET can_access = EXCLUDED.can_access;
END $$;
