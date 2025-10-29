-- Add permission for admin role to access child profiles
INSERT INTO role_permissions (role, menu_item, can_access)
VALUES ('admin', 'child', true)
ON CONFLICT DO NOTHING;

-- Add permission for staff role to access child profiles  
INSERT INTO role_permissions (role, menu_item, can_access)
VALUES ('staff', 'child', true)
ON CONFLICT DO NOTHING;

-- Add permission for division_leader role to access child profiles
INSERT INTO role_permissions (role, menu_item, can_access)
VALUES ('division_leader', 'child', true)
ON CONFLICT DO NOTHING;

-- Add permission for specialist role to access child profiles
INSERT INTO role_permissions (role, menu_item, can_access)
VALUES ('specialist', 'child', true)
ON CONFLICT DO NOTHING;