-- Nurses (health_center role) need roster access to view campers and wristband assignments.

UPDATE public.role_permissions
SET can_access = true
WHERE role = 'health_center'::app_role
  AND menu_item IN ('roster', 'dashboard');

INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT c.id, 'health_center'::app_role, mi.menu_item, true
FROM public.companies c
CROSS JOIN (
  VALUES ('roster'), ('dashboard')
) AS mi(menu_item)
WHERE COALESCE(c.is_active, true) = true
ON CONFLICT (company_id, role, menu_item)
DO UPDATE SET can_access = EXCLUDED.can_access;
