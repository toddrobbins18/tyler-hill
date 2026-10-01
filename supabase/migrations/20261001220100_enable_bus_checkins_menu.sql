-- Bus check-ins (arrived / depart) as separate menu from camper attendance.

INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT company_id, role, 'bus-check-ins', can_access
FROM public.role_permissions
WHERE menu_item = 'bus-attendance'
  AND can_access = true
ON CONFLICT (company_id, role, menu_item) DO UPDATE
  SET can_access = EXCLUDED.can_access;
