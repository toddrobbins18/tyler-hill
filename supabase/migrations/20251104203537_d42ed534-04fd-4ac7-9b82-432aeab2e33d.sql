-- Step 1: Delete incorrect permissions for Timber Lake Camp and Timber Lake West
DELETE FROM role_permissions 
WHERE company_id IN (
  '1d296ccf-31e1-4176-af57-50a4a4820f82', -- Timber Lake Camp
  '9cbae52b-cdf8-4fab-88f5-fb949f0bde2a'  -- Timber Lake West
);

-- Step 2: Insert correct permissions by copying Tyler Hill's structure
-- Get all role_permissions from Tyler Hill and replicate for Timber Lake Camp
INSERT INTO role_permissions (role, menu_item, can_access, company_id)
SELECT 
  role,
  menu_item,
  can_access,
  '1d296ccf-31e1-4176-af57-50a4a4820f82'::uuid as company_id
FROM role_permissions
WHERE company_id = 'c87719c7-5438-44be-bd09-75e731f465f4'; -- Tyler Hill Camp

-- Insert correct permissions for Timber Lake West
INSERT INTO role_permissions (role, menu_item, can_access, company_id)
SELECT 
  role,
  menu_item,
  can_access,
  '9cbae52b-cdf8-4fab-88f5-fb949f0bde2a'::uuid as company_id
FROM role_permissions
WHERE company_id = 'c87719c7-5438-44be-bd09-75e731f465f4'; -- Tyler Hill Camp