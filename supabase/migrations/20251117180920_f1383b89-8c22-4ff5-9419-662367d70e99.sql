-- Add Reports permissions for Tyler Hill Camp
INSERT INTO role_permissions (company_id, role, menu_item, can_access)
VALUES 
  -- Tyler Hill Camp (company_id: 0d0b7f4f-327e-4497-83ff-3aa501ffc295)
  ('0d0b7f4f-327e-4497-83ff-3aa501ffc295', 'admin', 'reports', true),
  ('0d0b7f4f-327e-4497-83ff-3aa501ffc295', 'super_admin', 'reports', true),
  ('0d0b7f4f-327e-4497-83ff-3aa501ffc295', 'staff', 'reports', true)
ON CONFLICT (company_id, role, menu_item) DO UPDATE
  SET can_access = EXCLUDED.can_access;