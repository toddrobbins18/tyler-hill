-- Fix hourly CampMinder cron: pg_net exposes net.http_post, not extensions.http_post.
-- Vault must define SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (Dashboard → Project Settings → Vault),
-- or this function raises with instructions.

CREATE OR REPLACE FUNCTION public.trigger_campminder_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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
    RAISE EXCEPTION
      'CampMinder cron: Vault secret SUPABASE_URL is missing. Add it in Supabase Dashboard → Project Settings → Vault (value: https://<project-ref>.supabase.co).';
  END IF;

  IF service_role_key IS NULL OR trim(service_role_key) = '' THEN
    RAISE EXCEPTION
      'CampMinder cron: Vault secret SUPABASE_SERVICE_ROLE_KEY is missing. Add it in Dashboard → Vault (use the service_role key from Project Settings → API).';
  END IF;

  SELECT net.http_post(
    url := trim(trailing '/' from supabase_url) || '/functions/v1/sync-campminder',
    body := jsonb_build_object('sync_all', true),
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    timeout_milliseconds := 120000
  ) INTO request_id;

  RAISE NOTICE 'CampMinder sync-campminder queued via pg_net, request_id=% at %', request_id, clock_timestamp();
END;
$$;
