-- Add default role permissions for OD Management and Appointments for Tyler Hill Camp
INSERT INTO role_permissions (role, menu_item, can_access, company_id)
SELECT 
  role,
  menu_item,
  true,
  '0d0b7f4f-327e-4497-83ff-3aa501ffc295'
FROM (
  VALUES 
    ('admin'::app_role, 'od-management'),
    ('admin'::app_role, 'appointments'),
    ('staff'::app_role, 'od-management'),
    ('staff'::app_role, 'appointments'),
    ('specialist'::app_role, 'od-management'),
    ('specialist'::app_role, 'appointments')
) AS t(role, menu_item)
ON CONFLICT (role, menu_item, company_id) DO NOTHING;