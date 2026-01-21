-- Create new company: Trails End Camp (mirroring Tyler Hill Camp settings)
INSERT INTO companies (id, name, slug, theme_color, is_active, zip_code)
VALUES (
  gen_random_uuid(),
  'Trails End Camp',
  'trails-end-camp',
  '#2E7D32',  -- Different green theme color
  true,
  '18428'    -- Nearby PA zip code
);

-- Get the new company ID for subsequent inserts
DO $$
DECLARE
  new_company_id uuid;
BEGIN
  SELECT id INTO new_company_id FROM companies WHERE slug = 'trails-end-camp';

  -- Insert divisions (mirroring Tyler Hill structure)
  INSERT INTO divisions (company_id, name, gender, is_active, sort_order) VALUES
    (new_company_id, 'Freshmen A Girls', 'Girls', true, 1),
    (new_company_id, 'Freshmen B Girls', 'Girls', true, 2),
    (new_company_id, 'Cadet Girls', 'Girls', true, 3),
    (new_company_id, 'Sophomore Girls', 'Girls', true, 4),
    (new_company_id, 'Junior Girls', 'Girls', true, 5),
    (new_company_id, 'Senior Girls', 'Girls', true, 6),
    (new_company_id, 'Sub Senior Girls', 'Girls', true, 7),
    (new_company_id, 'Super Senior Girls', 'Girls', true, 8),
    (new_company_id, 'CIT Girls', 'Girls', true, 9),
    (new_company_id, 'Freshmen A Boys', 'Boys', true, 10),
    (new_company_id, 'Freshmen B Boys', 'Boys', true, 11),
    (new_company_id, 'Cadet Boys', 'Boys', true, 12),
    (new_company_id, 'Sophomore Boys', 'Boys', true, 13),
    (new_company_id, 'Junior Boys', 'Boys', true, 14),
    (new_company_id, 'Senior Boys', 'Boys', true, 15),
    (new_company_id, 'Sub Senior Boys', 'Boys', true, 16),
    (new_company_id, 'Super Senior Boys', 'Boys', true, 17),
    (new_company_id, 'CIT Boys', 'Boys', true, 18);

  -- Insert role permissions (mirroring Tyler Hill permissions)
  -- Admin permissions
  INSERT INTO role_permissions (company_id, role, menu_item, can_access) VALUES
    (new_company_id, 'admin', 'activities', true),
    (new_company_id, 'admin', 'admin', true),
    (new_company_id, 'admin', 'appointments', true),
    (new_company_id, 'admin', 'awards', true),
    (new_company_id, 'admin', 'calendar', true),
    (new_company_id, 'admin', 'dashboard', true),
    (new_company_id, 'admin', 'division-permissions', true),
    (new_company_id, 'admin', 'evaluation-questions', true),
    (new_company_id, 'admin', 'incidents', true),
    (new_company_id, 'admin', 'menu', true),
    (new_company_id, 'admin', 'messages', true),
    (new_company_id, 'admin', 'notes', true),
    (new_company_id, 'admin', 'nurse', true),
    (new_company_id, 'admin', 'od-management', true),
    (new_company_id, 'admin', 'rainy-day', true),
    (new_company_id, 'admin', 'reports', true),
    (new_company_id, 'admin', 'role-permissions', true),
    (new_company_id, 'admin', 'roster', true),
    (new_company_id, 'admin', 'roster-templates', true),
    (new_company_id, 'admin', 'special-events', true),
    (new_company_id, 'admin', 'special-meals', true),
    (new_company_id, 'admin', 'sports-academy', true),
    (new_company_id, 'admin', 'sports-calendar', true),
    (new_company_id, 'admin', 'staff', true),
    (new_company_id, 'admin', 'transportation', true),
    (new_company_id, 'admin', 'tutoring-therapy', true),
    (new_company_id, 'admin', 'user-approvals', true);

  -- Staff permissions
  INSERT INTO role_permissions (company_id, role, menu_item, can_access) VALUES
    (new_company_id, 'staff', 'activities', true),
    (new_company_id, 'staff', 'admin', false),
    (new_company_id, 'staff', 'appointments', true),
    (new_company_id, 'staff', 'awards', true),
    (new_company_id, 'staff', 'calendar', true),
    (new_company_id, 'staff', 'dashboard', true),
    (new_company_id, 'staff', 'division-permissions', false),
    (new_company_id, 'staff', 'evaluation-questions', false),
    (new_company_id, 'staff', 'incidents', true),
    (new_company_id, 'staff', 'menu', true),
    (new_company_id, 'staff', 'messages', true),
    (new_company_id, 'staff', 'notes', true),
    (new_company_id, 'staff', 'nurse', true),
    (new_company_id, 'staff', 'od-management', true),
    (new_company_id, 'staff', 'rainy-day', true),
    (new_company_id, 'staff', 'reports', true),
    (new_company_id, 'staff', 'role-permissions', false),
    (new_company_id, 'staff', 'roster', true),
    (new_company_id, 'staff', 'special-events', true),
    (new_company_id, 'staff', 'special-meals', true),
    (new_company_id, 'staff', 'sports-academy', true),
    (new_company_id, 'staff', 'sports-calendar', true),
    (new_company_id, 'staff', 'staff', false),
    (new_company_id, 'staff', 'transportation', true),
    (new_company_id, 'staff', 'tutoring-therapy', true),
    (new_company_id, 'staff', 'user-approvals', false);

  -- Viewer permissions
  INSERT INTO role_permissions (company_id, role, menu_item, can_access) VALUES
    (new_company_id, 'viewer', 'activities', true),
    (new_company_id, 'viewer', 'admin', false),
    (new_company_id, 'viewer', 'awards', true),
    (new_company_id, 'viewer', 'calendar', true),
    (new_company_id, 'viewer', 'dashboard', true),
    (new_company_id, 'viewer', 'division-permissions', false),
    (new_company_id, 'viewer', 'evaluation-questions', false),
    (new_company_id, 'viewer', 'incidents', false),
    (new_company_id, 'viewer', 'menu', true),
    (new_company_id, 'viewer', 'messages', true),
    (new_company_id, 'viewer', 'notes', true),
    (new_company_id, 'viewer', 'nurse', false),
    (new_company_id, 'viewer', 'rainy-day', true),
    (new_company_id, 'viewer', 'role-permissions', false),
    (new_company_id, 'viewer', 'roster', true),
    (new_company_id, 'viewer', 'special-events', true),
    (new_company_id, 'viewer', 'special-meals', true),
    (new_company_id, 'viewer', 'sports-academy', false),
    (new_company_id, 'viewer', 'sports-calendar', true),
    (new_company_id, 'viewer', 'staff', false),
    (new_company_id, 'viewer', 'transportation', true),
    (new_company_id, 'viewer', 'tutoring-therapy', false),
    (new_company_id, 'viewer', 'user-approvals', false);

  -- Division Leader permissions
  INSERT INTO role_permissions (company_id, role, menu_item, can_access) VALUES
    (new_company_id, 'division_leader', 'activities', true),
    (new_company_id, 'division_leader', 'admin', false),
    (new_company_id, 'division_leader', 'awards', true),
    (new_company_id, 'division_leader', 'calendar', true),
    (new_company_id, 'division_leader', 'dashboard', true),
    (new_company_id, 'division_leader', 'division-permissions', false),
    (new_company_id, 'division_leader', 'evaluation-questions', false),
    (new_company_id, 'division_leader', 'incidents', true),
    (new_company_id, 'division_leader', 'menu', true),
    (new_company_id, 'division_leader', 'messages', true),
    (new_company_id, 'division_leader', 'notes', true),
    (new_company_id, 'division_leader', 'nurse', true),
    (new_company_id, 'division_leader', 'rainy-day', true),
    (new_company_id, 'division_leader', 'role-permissions', false),
    (new_company_id, 'division_leader', 'roster', true),
    (new_company_id, 'division_leader', 'special-events', true),
    (new_company_id, 'division_leader', 'special-meals', true),
    (new_company_id, 'division_leader', 'sports-academy', true),
    (new_company_id, 'division_leader', 'sports-calendar', true),
    (new_company_id, 'division_leader', 'staff', false),
    (new_company_id, 'division_leader', 'transportation', true),
    (new_company_id, 'division_leader', 'tutoring-therapy', true),
    (new_company_id, 'division_leader', 'user-approvals', false);

  -- Specialist permissions
  INSERT INTO role_permissions (company_id, role, menu_item, can_access) VALUES
    (new_company_id, 'specialist', 'activities', true),
    (new_company_id, 'specialist', 'admin', false),
    (new_company_id, 'specialist', 'awards', true),
    (new_company_id, 'specialist', 'calendar', true),
    (new_company_id, 'specialist', 'dashboard', true),
    (new_company_id, 'specialist', 'division-permissions', false),
    (new_company_id, 'specialist', 'evaluation-questions', false),
    (new_company_id, 'specialist', 'incidents', true),
    (new_company_id, 'specialist', 'menu', true),
    (new_company_id, 'specialist', 'messages', true),
    (new_company_id, 'specialist', 'notes', true),
    (new_company_id, 'specialist', 'nurse', true),
    (new_company_id, 'specialist', 'rainy-day', true),
    (new_company_id, 'specialist', 'role-permissions', false),
    (new_company_id, 'specialist', 'roster', true),
    (new_company_id, 'specialist', 'special-events', true),
    (new_company_id, 'specialist', 'special-meals', true),
    (new_company_id, 'specialist', 'sports-academy', true),
    (new_company_id, 'specialist', 'sports-calendar', true),
    (new_company_id, 'specialist', 'staff', false),
    (new_company_id, 'specialist', 'transportation', true),
    (new_company_id, 'specialist', 'tutoring-therapy', true),
    (new_company_id, 'specialist', 'user-approvals', false);

  -- Health Center permissions
  INSERT INTO role_permissions (company_id, role, menu_item, can_access) VALUES
    (new_company_id, 'health_center', 'dashboard', true),
    (new_company_id, 'health_center', 'nurse', true),
    (new_company_id, 'health_center', 'roster', true),
    (new_company_id, 'health_center', 'incidents', true),
    (new_company_id, 'health_center', 'appointments', true),
    (new_company_id, 'health_center', 'admin', false),
    (new_company_id, 'health_center', 'activities', false),
    (new_company_id, 'health_center', 'awards', false),
    (new_company_id, 'health_center', 'calendar', true),
    (new_company_id, 'health_center', 'division-permissions', false),
    (new_company_id, 'health_center', 'evaluation-questions', false),
    (new_company_id, 'health_center', 'menu', true),
    (new_company_id, 'health_center', 'messages', true),
    (new_company_id, 'health_center', 'notes', true),
    (new_company_id, 'health_center', 'rainy-day', false),
    (new_company_id, 'health_center', 'role-permissions', false),
    (new_company_id, 'health_center', 'special-events', false),
    (new_company_id, 'health_center', 'special-meals', false),
    (new_company_id, 'health_center', 'sports-academy', false),
    (new_company_id, 'health_center', 'sports-calendar', false),
    (new_company_id, 'health_center', 'staff', false),
    (new_company_id, 'health_center', 'transportation', true),
    (new_company_id, 'health_center', 'tutoring-therapy', false),
    (new_company_id, 'health_center', 'user-approvals', false);

END $$;