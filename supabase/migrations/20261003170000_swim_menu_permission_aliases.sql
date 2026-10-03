-- Map legacy swim-bracelets / swim-progress permissions to the unified Swim Program menu (swim).
-- GROUP BY avoids duplicate (company_id, role, menu_item) rows when a role has both legacy IDs.

INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT company_id, role, 'swim', BOOL_OR(can_access)
FROM public.role_permissions
WHERE menu_item IN ('swim-bracelets', 'swim-progress')
  AND can_access = true
GROUP BY company_id, role
ON CONFLICT (company_id, role, menu_item) DO UPDATE
  SET can_access = EXCLUDED.can_access;

-- Staff with swim access can open Swim Lessons scheduling unless explicitly denied.
INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT company_id, role, 'swim-lessons', BOOL_OR(can_access)
FROM public.role_permissions
WHERE menu_item IN ('swim-bracelets', 'swim-progress', 'swim')
  AND can_access = true
GROUP BY company_id, role
ON CONFLICT (company_id, role, menu_item) DO UPDATE
  SET can_access = EXCLUDED.can_access;
