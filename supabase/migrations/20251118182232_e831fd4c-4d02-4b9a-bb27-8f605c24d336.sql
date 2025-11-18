-- Insert default permissions for health_center role
INSERT INTO role_permissions (role, menu_item, can_access, company_id)
SELECT 
  'health_center'::app_role,
  unnest(ARRAY['dashboard', 'roster', 'nurse', 'incidents', 'notes', 'messages'])::text,
  true,
  id
FROM companies
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions 
  WHERE role = 'health_center'::app_role 
  AND company_id = companies.id
);

-- Set default permissions to false for other menu items
INSERT INTO role_permissions (role, menu_item, can_access, company_id)
SELECT 
  'health_center'::app_role,
  unnest(ARRAY['staff', 'admin', 'role-permissions', 'division-permissions', 'user-approvals', 'activities', 'calendar', 'menu', 'rainy-day', 'special-events', 'special-meals', 'transportation', 'tutoring-therapy', 'awards', 'sports-academy', 'sports-calendar', 'athletics', 'daily-wolf-printable', 'daily-wolf-management', 'evaluation-questions'])::text,
  false,
  id
FROM companies
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions 
  WHERE role = 'health_center'::app_role 
  AND company_id = companies.id
);