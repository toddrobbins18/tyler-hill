-- Update encrypt_secret function to use extensions schema
CREATE OR REPLACE FUNCTION public.encrypt_secret(secret text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  encryption_key text;
BEGIN
  encryption_key := COALESCE(
    current_setting('app.settings.encryption_key', true),
    'default-encryption-key-change-in-production'
  );
  
  RETURN encode(
    extensions.pgp_sym_encrypt(secret, encryption_key),
    'base64'
  );
END;
$function$;

-- Update decrypt_secret function to use extensions schema
CREATE OR REPLACE FUNCTION public.decrypt_secret(encrypted text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  encryption_key text;
BEGIN
  encryption_key := COALESCE(
    current_setting('app.settings.encryption_key', true),
    'default-encryption-key-change-in-production'
  );
  
  RETURN extensions.pgp_sym_decrypt(
    decode(encrypted, 'base64'),
    encryption_key
  );
END;
$function$;