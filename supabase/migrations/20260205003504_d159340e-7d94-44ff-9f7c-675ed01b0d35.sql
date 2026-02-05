
-- Add missing menu items to role_permissions for all companies and roles

-- First, get all unique company_id + role combinations that exist
-- Then insert the missing menu items for each

-- Add 'specialist-sport-assignments' menu item
INSERT INTO role_permissions (company_id, role, menu_item, can_access)
SELECT DISTINCT company_id, role, 'specialist-sport-assignments', 
  CASE WHEN role IN ('admin', 'super_admin') THEN true ELSE false END
FROM role_permissions
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp2 
  WHERE rp2.company_id = role_permissions.company_id 
    AND rp2.role = role_permissions.role 
    AND rp2.menu_item = 'specialist-sport-assignments'
)
ON CONFLICT DO NOTHING;

-- Add 'notification-preferences' menu item (should be accessible by all roles)
INSERT INTO role_permissions (company_id, role, menu_item, can_access)
SELECT DISTINCT company_id, role, 'notification-preferences', true
FROM role_permissions
WHERE NOT EXISTS (
  SELECT 1 FROM role_permissions rp2 
  WHERE rp2.company_id = role_permissions.company_id 
    AND rp2.role = role_permissions.role 
    AND rp2.menu_item = 'notification-preferences'
)
ON CONFLICT DO NOTHING;
