-- Fix the unique constraint to include company_id
-- Drop the old constraint that doesn't include company_id
ALTER TABLE role_permissions DROP CONSTRAINT IF EXISTS role_permissions_role_menu_item_key;

-- Add new constraint that includes company_id
ALTER TABLE role_permissions ADD CONSTRAINT role_permissions_company_role_menu_unique 
UNIQUE (company_id, role, menu_item);

-- Now insert role permissions for Timber Lake West
INSERT INTO role_permissions (company_id, role, menu_item, can_access) VALUES
-- Admin access
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'admin', 'dashboard', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'admin', 'roster', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'admin', 'staff', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'admin', 'activities', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'admin', 'athletics', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'admin', 'daily-wolf', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'admin', 'notes', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'admin', 'rainy-day', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'admin', 'calendar', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'admin', 'menu', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'admin', 'messages', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'admin', 'special-events', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'admin', 'special-meals', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'admin', 'transportation', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'admin', 'tutoring-therapy', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'admin', 'admin', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'admin', 'evaluation-questions', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'admin', 'role-permissions', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'admin', 'division-permissions', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'admin', 'user-approvals', true),
-- Viewer access
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'viewer', 'dashboard', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'viewer', 'roster', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'viewer', 'staff', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'viewer', 'activities', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'viewer', 'athletics', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'viewer', 'daily-wolf', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'viewer', 'notes', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'viewer', 'rainy-day', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'viewer', 'calendar', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'viewer', 'menu', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'viewer', 'messages', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'viewer', 'special-events', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'viewer', 'special-meals', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'viewer', 'transportation', true),
('9cbae52b-cdf8-4fab-88f5-fb949f0bde2a', 'viewer', 'tutoring-therapy', true);