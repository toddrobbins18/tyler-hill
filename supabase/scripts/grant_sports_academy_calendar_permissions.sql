-- Re-runnable: mirror Sports Academy page permissions for Sports Academy Calendar.

INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT company_id, role, 'sports-academy-calendar', can_access
FROM public.role_permissions
WHERE menu_item = 'sports-academy'
ON CONFLICT (company_id, role, menu_item) DO UPDATE
SET can_access = EXCLUDED.can_access;
