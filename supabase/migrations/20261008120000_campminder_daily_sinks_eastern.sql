-- Todd daily CampMinder "sinks" (America/New_York), in addition to existing twice-daily campers/staff:
--   4:00 AM — home addresses (transport routing)
--   5:00 AM — session / enrolled_weeks only (bubble sheets, enrollment week)
--   6:00 AM / 6:00 PM — campers (new enrollments + roster)
--   7:00 AM / 7:00 PM — staff (new hires)
--   8:00 AM / 8:00 PM — Owl Pay financials

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
  IF sync_type NOT IN ('campers', 'staff', 'full', 'financials', 'addresses', 'enrollment_weeks') THEN
    RAISE EXCEPTION
      'trigger_campminder_sync: invalid sync_type % (use campers, staff, full, financials, addresses, enrollment_weeks)',
      sync_type;
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

CREATE OR REPLACE FUNCTION public.run_campminder_eastern_sync_window()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  et_hour int;
BEGIN
  et_hour := EXTRACT(HOUR FROM (timezone('America/New_York', now())))::int;

  IF et_hour = 4 THEN
    PERFORM public.trigger_campminder_sync('addresses');
  ELSIF et_hour = 5 THEN
    PERFORM public.trigger_campminder_sync('enrollment_weeks');
  ELSIF et_hour = 6 THEN
    PERFORM public.trigger_campminder_sync('campers');
  ELSIF et_hour = 7 THEN
    PERFORM public.trigger_campminder_sync('staff');
  ELSIF et_hour = 8 THEN
    PERFORM public.trigger_campminder_sync('financials');
  ELSIF et_hour = 18 THEN
    PERFORM public.trigger_campminder_sync('campers');
  ELSIF et_hour = 19 THEN
    PERFORM public.trigger_campminder_sync('staff');
  ELSIF et_hour = 20 THEN
    PERFORM public.trigger_campminder_sync('financials');
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_campminder_eastern_pre_sync_cleanup()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  et_hour int;
BEGIN
  et_hour := EXTRACT(HOUR FROM (timezone('America/New_York', now())))::int;

  -- 3 / 15 = before addresses (4); 5 / 17 = before campers (6); 7 / 19 = before financials (8)
  IF et_hour IN (3, 5, 15, 17, 7, 19) THEN
    PERFORM public.cleanup_stale_campminder_sync_jobs(150);
  END IF;
END;
$$;
