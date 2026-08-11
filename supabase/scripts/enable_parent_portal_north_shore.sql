-- Enable Parent Portal sidebar access for North Shore Day Camp roles (safe to re-run)
DO $$
DECLARE
  ns_company_id uuid;
BEGIN
  SELECT id INTO ns_company_id FROM public.companies WHERE slug = 'north-shore-day-camp';

  IF ns_company_id IS NULL THEN
    RAISE EXCEPTION 'North Shore Day Camp not found';
  END IF;

  INSERT INTO public.role_permissions (company_id, role, menu_item, can_access) VALUES
    (ns_company_id, 'admin', 'parent-portal', true),
    (ns_company_id, 'super_admin', 'parent-portal', true),
    (ns_company_id, 'division_leader', 'parent-portal', true),
    (ns_company_id, 'staff', 'parent-portal', true)
  ON CONFLICT (company_id, role, menu_item) DO UPDATE SET can_access = EXCLUDED.can_access;
END $$;
