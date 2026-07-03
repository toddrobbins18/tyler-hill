-- Health center admit/checkout notifications were calling a hardcoded old project URL
-- (gdcxtefbarvnrtvacqln). Manual edge-function tests worked; Nest admits did not.
-- Use Vault SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (same pattern as medication crons).

CREATE OR REPLACE FUNCTION public.notify_health_center()
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
    RAISE WARNING 'notify_health_center: Vault secret SUPABASE_URL is missing';
    RETURN NEW;
  END IF;

  IF service_role_key IS NULL OR trim(service_role_key) = '' THEN
    RAISE WARNING 'notify_health_center: Vault secret SUPABASE_SERVICE_ROLE_KEY is missing';
    RETURN NEW;
  END IF;

  SELECT net.http_post(
    url := rtrim(supabase_url, '/') || '/functions/v1/send-health-center-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := jsonb_build_object(
      'admission_id', NEW.id,
      'action', TG_OP,
      'event_type', CASE
        WHEN NEW.checked_out_at IS NOT NULL
          AND (TG_OP = 'INSERT' OR OLD.checked_out_at IS NULL)
        THEN 'checkout'
        ELSE 'admission'
      END
    )
  ) INTO request_id;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_health_center failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;
