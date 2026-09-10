-- Run in Supabase SQL Editor after deploy.
-- Adds "Bus Attendance" sidebar permission for roles that have Transportation.

INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT company_id, role, 'bus-attendance', can_access
FROM public.role_permissions
WHERE menu_item = 'transportation'
  AND can_access = true
ON CONFLICT (company_id, role, menu_item) DO UPDATE
  SET can_access = EXCLUDED.can_access;
