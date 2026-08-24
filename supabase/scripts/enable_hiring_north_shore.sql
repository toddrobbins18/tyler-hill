-- Enable Hiring menu for North Shore Day Camp.
-- Run in Supabase SQL Editor (safe to re-run).

DO $$
DECLARE
  ns_company_id uuid;
BEGIN
  SELECT id INTO ns_company_id FROM public.companies WHERE slug = 'north-shore-day-camp';
  IF ns_company_id IS NULL THEN
    RAISE EXCEPTION 'north-shore-day-camp not found';
  END IF;

  INSERT INTO public.role_permissions (company_id, role, menu_item, can_access) VALUES
    (ns_company_id, 'admin', 'hiring', true),
    (ns_company_id, 'staff', 'hiring', true),
    (ns_company_id, 'division_leader', 'hiring', true)
  ON CONFLICT (company_id, role, menu_item) DO UPDATE SET can_access = EXCLUDED.can_access;
END $$;

SELECT rp.role, rp.menu_item, rp.can_access
FROM public.role_permissions rp
JOIN public.companies c ON c.id = rp.company_id
WHERE c.slug = 'north-shore-day-camp' AND rp.menu_item = 'hiring'
ORDER BY rp.role;
