-- Staff Time Clock is for day camps (North Shore, etc.), not overnight camps.

INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT rp.company_id, rp.role, 'staff-time-clock', rp.can_access
FROM public.role_permissions rp
JOIN public.companies c ON c.id = rp.company_id
WHERE rp.menu_item = 'staff'
  AND (c.camp_type = 'day_camp' OR c.slug = 'north-shore-day-camp')
ON CONFLICT (company_id, role, menu_item) DO UPDATE SET can_access = EXCLUDED.can_access;

INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT c.id, 'admin'::public.app_role, 'staff-time-clock', true
FROM public.companies c
WHERE c.camp_type = 'day_camp' OR c.slug = 'north-shore-day-camp'
ON CONFLICT (company_id, role, menu_item) DO UPDATE SET can_access = true;

INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT c.id, 'division_leader'::public.app_role, 'staff-time-clock', true
FROM public.companies c
WHERE c.camp_type = 'day_camp' OR c.slug = 'north-shore-day-camp'
ON CONFLICT (company_id, role, menu_item) DO UPDATE SET can_access = true;
