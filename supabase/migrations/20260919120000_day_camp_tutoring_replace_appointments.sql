-- Day camp: remove Appointments from menu; grant Tutoring & Therapy (Timber Lake module) instead.

INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT rp.company_id, rp.role, 'tutoring-therapy', rp.can_access
FROM public.role_permissions rp
JOIN public.companies c ON c.id = rp.company_id
WHERE (c.camp_type = 'day_camp' OR c.slug = 'north-shore-day-camp')
  AND rp.menu_item = 'appointments'
ON CONFLICT (company_id, role, menu_item) DO UPDATE SET can_access = EXCLUDED.can_access;

UPDATE public.role_permissions rp
SET can_access = false
FROM public.companies c
WHERE c.id = rp.company_id
  AND (c.camp_type = 'day_camp' OR c.slug = 'north-shore-day-camp')
  AND rp.menu_item = 'appointments';
