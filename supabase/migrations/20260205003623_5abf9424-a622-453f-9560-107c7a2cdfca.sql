
-- Ensure ALL menu items exist for ALL roles in ALL companies
-- This creates the complete matrix of permissions

-- Get the full list of menu items that should exist
WITH all_menu_items AS (
  SELECT unnest(ARRAY[
    'activities', 'admin', 'appointments', 'athletics', 'awards', 'calendar',
    'daily-schedule', 'daily-wolf-management', 'daily-wolf-printable', 'dashboard',
    'division-permissions', 'evaluation-questions', 'incidents', 'menu', 'messages',
    'notes', 'notification-preferences', 'nurse', 'od-management', 'rainy-day',
    'reports', 'role-permissions', 'roster', 'roster-templates', 'special-events',
    'special-meals', 'specialist-sport-assignments', 'sports-academy', 'sports-calendar',
    'staff', 'transportation', 'tutoring-therapy', 'user-approvals'
  ]) as menu_item
),
all_roles AS (
  SELECT unnest(ARRAY[
    'admin', 'staff', 'viewer', 'division_leader', 'specialist', 'super_admin', 'health_center'
  ]::app_role[]) as role
),
all_companies AS (
  SELECT id as company_id FROM companies WHERE is_active = true
),
-- Create the full matrix
full_matrix AS (
  SELECT 
    c.company_id,
    r.role,
    m.menu_item,
    -- Default access based on role and menu item
    CASE 
      -- Super admin and admin get access to admin pages
      WHEN m.menu_item IN ('admin', 'role-permissions', 'division-permissions', 
                           'evaluation-questions', 'user-approvals', 'specialist-sport-assignments') 
           AND r.role IN ('admin', 'super_admin') THEN true
      -- Staff-level pages
      WHEN m.menu_item IN ('dashboard', 'roster', 'staff', 'calendar', 'menu', 'messages',
                           'activities', 'athletics', 'sports-calendar', 'transportation',
                           'notes', 'awards', 'incidents', 'nurse', 'sports-academy',
                           'rainy-day', 'special-events', 'tutoring-therapy', 'roster-templates',
                           'od-management', 'appointments', 'daily-schedule', 'reports',
                           'daily-wolf-printable', 'daily-wolf-management', 'special-meals',
                           'notification-preferences')
           AND r.role IN ('admin', 'super_admin', 'staff') THEN true
      -- Health center specific
      WHEN m.menu_item IN ('nurse', 'appointments', 'od-management') 
           AND r.role = 'health_center' THEN true
      -- Basic view access for division-based roles
      WHEN m.menu_item IN ('dashboard', 'roster', 'calendar', 'menu', 'athletics', 
                           'sports-calendar', 'activities', 'special-events', 'awards',
                           'notification-preferences')
           AND r.role IN ('division_leader', 'specialist', 'viewer') THEN true
      ELSE false
    END as can_access
  FROM all_companies c
  CROSS JOIN all_roles r
  CROSS JOIN all_menu_items m
)
-- Insert missing entries
INSERT INTO role_permissions (company_id, role, menu_item, can_access)
SELECT fm.company_id, fm.role, fm.menu_item, fm.can_access
FROM full_matrix fm
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp
  WHERE rp.company_id = fm.company_id
    AND rp.role = fm.role
    AND rp.menu_item = fm.menu_item
)
ON CONFLICT (company_id, role, menu_item) DO NOTHING;
