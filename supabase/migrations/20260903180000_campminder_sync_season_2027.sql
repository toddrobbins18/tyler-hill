-- CampMinder scheduled sync: use season 2027 (2026 remains historical in Nest).

CREATE OR REPLACE FUNCTION public.trigger_campminder_sync(p_sync_type text DEFAULT 'campers')
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
  request_id bigint;
  sync_type text := COALESCE(NULLIF(trim(p_sync_type), ''), 'campers');
BEGIN
  IF sync_type NOT IN ('campers', 'staff', 'full', 'financials') THEN
    RAISE EXCEPTION 'trigger_campminder_sync: invalid sync_type % (use campers, staff, full, financials)', sync_type;
  END IF;

  SELECT decrypted_secret INTO supabase_url
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_URL';

  SELECT decrypted_secret INTO service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

  IF supabase_url IS NULL OR trim(supabase_url) = '' THEN
    RAISE EXCEPTION 'CampMinder cron: Vault secret SUPABASE_URL is missing.';
  END IF;

  IF service_role_key IS NULL OR trim(service_role_key) = '' THEN
    RAISE EXCEPTION 'CampMinder cron: Vault secret SUPABASE_SERVICE_ROLE_KEY is missing.';
  END IF;

  SELECT net.http_post(
    url := trim(trailing '/' from supabase_url) || '/functions/v1/sync-campminder',
    body := jsonb_build_object(
      'sync_type', sync_type,
      'season_id', 2027,
      'incremental', false
    ),
    params := '{}'::jsonb,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    timeout_milliseconds := 120000
  ) INTO request_id;

  RAISE NOTICE 'CampMinder sync_type=% queued (ET window), request_id=% at %',
    sync_type, request_id, clock_timestamp();
END;
$$;
