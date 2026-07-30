-- Appointment saves failed with:
--   unrecognized configuration parameter "app.settings.supabase_url"
-- notify_appointment() used current_setting() instead of Vault secrets.

CREATE OR REPLACE FUNCTION public.notify_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  supabase_url text;
  service_role_key text;
  request_id bigint;
BEGIN
  SELECT decrypted_secret INTO supabase_url
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_URL';

  SELECT decrypted_secret INTO service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

  IF supabase_url IS NULL OR trim(supabase_url) = '' THEN
    RAISE WARNING 'notify_appointment: Vault secret SUPABASE_URL is missing';
    RETURN NEW;
  END IF;

  IF service_role_key IS NULL OR trim(service_role_key) = '' THEN
    RAISE WARNING 'notify_appointment: Vault secret SUPABASE_SERVICE_ROLE_KEY is missing';
    RETURN NEW;
  END IF;

  SELECT net.http_post(
    url := rtrim(supabase_url, '/') || '/functions/v1/send-appointment-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'appointment_id', NEW.id,
      'action', CASE WHEN TG_OP = 'INSERT' THEN 'create' ELSE 'update' END
    )
  ) INTO request_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_appointment failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;
