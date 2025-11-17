-- Enable pgcrypto extension for encryption
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create company_email_config table
CREATE TABLE company_email_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Microsoft 365 Configuration
  m365_tenant_id text,
  m365_client_id text,
  m365_client_secret_encrypted text,
  m365_sender_email text,
  m365_sender_name text,
  
  -- Configuration Status
  is_configured boolean DEFAULT false,
  is_active boolean DEFAULT true,
  
  -- Audit fields
  configured_by uuid REFERENCES auth.users(id),
  configured_at timestamp with time zone,
  last_tested_at timestamp with time zone,
  last_test_status text,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  
  CONSTRAINT unique_company_email UNIQUE(company_id)
);

-- Enable RLS
ALTER TABLE company_email_config ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Admins can manage company email config
CREATE POLICY "Admins can manage company email config"
ON company_email_config
FOR ALL
USING (
  company_id = get_user_company(auth.uid())
  AND has_role(auth.uid(), 'admin'::app_role)
)
WITH CHECK (
  company_id = get_user_company(auth.uid())
  AND has_role(auth.uid(), 'admin'::app_role)
);

-- RLS Policy: Super admins can manage all configs
CREATE POLICY "Super admins can manage all email configs"
ON company_email_config
FOR ALL
USING (is_super_admin(auth.uid()));

-- Create encryption functions
CREATE OR REPLACE FUNCTION encrypt_secret(secret text)
RETURNS text AS $$
DECLARE
  encryption_key text;
BEGIN
  -- Use a consistent encryption key from settings or generate one
  -- In production, this should come from a secure secret
  encryption_key := COALESCE(
    current_setting('app.settings.encryption_key', true),
    'default-encryption-key-change-in-production'
  );
  
  RETURN encode(
    pgp_sym_encrypt(secret, encryption_key),
    'base64'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION decrypt_secret(encrypted text)
RETURNS text AS $$
DECLARE
  encryption_key text;
BEGIN
  encryption_key := COALESCE(
    current_setting('app.settings.encryption_key', true),
    'default-encryption-key-change-in-production'
  );
  
  RETURN pgp_sym_decrypt(
    decode(encrypted, 'base64'),
    encryption_key
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add trigger for updated_at
CREATE TRIGGER update_company_email_config_updated_at
BEFORE UPDATE ON company_email_config
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();