-- Fix: Add search_path to encryption functions for security
CREATE OR REPLACE FUNCTION encrypt_secret(secret text)
RETURNS text 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  encryption_key text;
BEGIN
  encryption_key := COALESCE(
    current_setting('app.settings.encryption_key', true),
    'default-encryption-key-change-in-production'
  );
  
  RETURN encode(
    pgp_sym_encrypt(secret, encryption_key),
    'base64'
  );
END;
$$;

CREATE OR REPLACE FUNCTION decrypt_secret(encrypted text)
RETURNS text 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
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
$$;