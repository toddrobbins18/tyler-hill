-- Clean up role permissions to match company-specific menu structures

-- Step 1: Delete all outdated/incorrect menu items
DELETE FROM role_permissions WHERE menu_item IN ('child', 'daily-wolf');

-- Step 2: Clean up Timber Lake West - remove items they shouldn't have
-- Timber Lake West company_id: 9cbae52b-cdf8-4fab-88f5-fb949f0bde2a
DELETE FROM role_permissions 
WHERE company_id = '9cbae52b-cdf8-4fab-88f5-fb949f0bde2a' 
AND menu_item IN ('notes', 'awards', 'incidents', 'nurse', 'sports-academy', 'sports-calendar');

-- Step 3: Clean up other camps - remove items they shouldn't have
-- Tyler Hill: 0d0b7f4f-327e-4497-83ff-3aa501ffc295
-- Timber Lake Camp: 1d296ccf-31e1-4176-af57-50a4a4820f82
DELETE FROM role_permissions 
WHERE company_id IN ('0d0b7f4f-327e-4497-83ff-3aa501ffc295', '1d296ccf-31e1-4176-af57-50a4a4820f82')
AND menu_item IN ('athletics', 'daily-wolf-printable', 'daily-wolf-management');

-- Step 4: Add Timber Lake West specific items for all roles
INSERT INTO role_permissions (role, menu_item, can_access, company_id)
SELECT role, 'daily-wolf-management', true, '9cbae52b-cdf8-4fab-88f5-fb949f0bde2a'
FROM unnest(ARRAY['admin', 'staff', 'division_leader', 'specialist', 'viewer']::app_role[]) AS role
ON CONFLICT (role, menu_item, company_id) DO NOTHING;

INSERT INTO role_permissions (role, menu_item, can_access, company_id)
SELECT role, 'daily-wolf-printable', true, '9cbae52b-cdf8-4fab-88f5-fb949f0bde2a'
FROM unnest(ARRAY['admin', 'staff', 'division_leader', 'specialist', 'viewer']::app_role[]) AS role
ON CONFLICT (role, menu_item, company_id) DO NOTHING;

INSERT INTO role_permissions (role, menu_item, can_access, company_id)
SELECT role, 'athletics', true, '9cbae52b-cdf8-4fab-88f5-fb949f0bde2a'
FROM unnest(ARRAY['admin', 'staff', 'division_leader', 'specialist', 'viewer']::app_role[]) AS role
ON CONFLICT (role, menu_item, company_id) DO NOTHING;

-- Step 5: Add Tyler Hill & Timber Lake Camp items for all roles
INSERT INTO role_permissions (role, menu_item, can_access, company_id)
SELECT role, item, true, company_id
FROM unnest(ARRAY['admin', 'staff', 'division_leader', 'specialist', 'viewer']::app_role[]) AS role
CROSS JOIN unnest(ARRAY['notes', 'awards', 'incidents', 'nurse', 'sports-academy', 'sports-calendar']) AS item
CROSS JOIN unnest(ARRAY['0d0b7f4f-327e-4497-83ff-3aa501ffc295', '1d296ccf-31e1-4176-af57-50a4a4820f82']::uuid[]) AS company_id
ON CONFLICT (role, menu_item, company_id) DO NOTHING;

-- Step 6: Ensure all companies have common base menu items
INSERT INTO role_permissions (role, menu_item, can_access, company_id)
SELECT role, item, true, company_id
FROM unnest(ARRAY['admin', 'staff', 'division_leader', 'specialist', 'viewer']::app_role[]) AS role
CROSS JOIN unnest(ARRAY[
  'dashboard', 'roster', 'staff', 'messages', 'activities', 'calendar', 'menu', 
  'rainy-day', 'special-events', 'special-meals', 'transportation', 'tutoring-therapy',
  'admin', 'evaluation-questions', 'role-permissions', 'division-permissions', 'user-approvals'
]) AS item
CROSS JOIN unnest(ARRAY[
  '9cbae52b-cdf8-4fab-88f5-fb949f0bde2a',
  '0d0b7f4f-327e-4497-83ff-3aa501ffc295',
  '1d296ccf-31e1-4176-af57-50a4a4820f82'
]::uuid[]) AS company_id
ON CONFLICT (role, menu_item, company_id) DO NOTHING;