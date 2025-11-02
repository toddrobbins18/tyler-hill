-- Make company_id NOT NULL in all multi-tenancy tables
ALTER TABLE divisions ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE role_permissions ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE user_roles ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE division_permissions ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE automated_email_config ALTER COLUMN company_id SET NOT NULL;
ALTER TABLE user_tags ALTER COLUMN company_id SET NOT NULL;