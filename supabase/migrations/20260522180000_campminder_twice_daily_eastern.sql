-- CampMinder sync: twice daily at 6 AM and 6 PM America/New_York (Eastern, DST-aware).
--
-- Supabase pg_cron only supports cron.schedule(name, schedule, command) — no timezone arg.
-- We run hourly UTC checks and gate on America/New_York local time.
--
--   5:55 AM / 5:55 PM ET — clear stale stuck jobs
--   6:00 AM / 6:00 PM ET — campers sync
--   7:00 AM / 7:00 PM ET — staff sync (completes full sync window)

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
      'season_id', 2026,
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

-- Runs at minute :00 each hour (UTC cron); fires only at 6/7/18/19 Eastern.
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

  IF et_hour = 6 THEN
    PERFORM public.trigger_campminder_sync('campers');
  ELSIF et_hour = 7 THEN
    PERFORM public.trigger_campminder_sync('staff');
  ELSIF et_hour = 18 THEN
    PERFORM public.trigger_campminder_sync('campers');
  ELSIF et_hour = 19 THEN
    PERFORM public.trigger_campminder_sync('staff');
  END IF;
END;
$$;

-- Runs at minute :55 each hour (UTC cron); fires only at 5:55 AM/PM Eastern.
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

  IF et_hour IN (5, 17) THEN
    PERFORM public.cleanup_stale_campminder_sync_jobs(150);
  END IF;
END;
$$;

-- Remove all legacy schedules
DO $$
DECLARE
  job record;
BEGIN
  FOR job IN
    SELECT jobid, jobname FROM cron.job
    WHERE jobname IN (
      'campminder-hourly-sync',
      'campminder-campers-sync',
      'campminder-staff-sync',
      'campminder-am-campers',
      'campminder-am-staff',
      'campminder-pm-campers',
      'campminder-pm-staff',
      'campminder-pre-sync-cleanup-am',
      'campminder-pre-sync-cleanup-pm',
      'campminder-eastern-sync',
      'campminder-eastern-cleanup'
    )
  LOOP
    PERFORM cron.unschedule(job.jobid);
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

-- 3-arg cron.schedule only (Supabase-compatible)
SELECT cron.schedule(
  'campminder-eastern-sync',
  '0 * * * *',
  $$SELECT public.run_campminder_eastern_sync_window()$$
);

SELECT cron.schedule(
  'campminder-eastern-cleanup',
  '55 * * * *',
  $$SELECT public.run_campminder_eastern_pre_sync_cleanup()$$
);
