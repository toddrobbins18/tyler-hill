-- Auto sign-out staff at 4:15 PM Eastern if still clocked in.

CREATE OR REPLACE FUNCTION public.run_staff_time_clock_auto_signout()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_url text;
  v_key text;
  v_req_id bigint;
  v_hour int;
  v_minute int;
BEGIN
  -- Gate on America/New_York 4:15 PM (hourly cron at :15 UTC checks local time).
  v_hour := EXTRACT(HOUR FROM (now() AT TIME ZONE 'America/New_York'))::int;
  v_minute := EXTRACT(MINUTE FROM (now() AT TIME ZONE 'America/New_York'))::int;

  IF v_hour <> 16 OR v_minute < 15 OR v_minute > 20 THEN
    RETURN;
  END IF;

  SELECT decrypted_secret INTO v_url FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL';
  SELECT decrypted_secret INTO v_key FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

  IF v_url IS NULL OR v_key IS NULL THEN
    RAISE EXCEPTION 'Vault secrets missing for staff time clock auto sign-out';
  END IF;

  SELECT net.http_post(
    url := v_url || '/functions/v1/staff-time-clock-auto-signout',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb
  ) INTO v_req_id;
END;
$$;

SELECT cron.unschedule(jobid)
FROM cron.job
WHERE jobname = 'staff-time-clock-auto-signout';

SELECT cron.schedule(
  'staff-time-clock-auto-signout',
  '15 * * * *',
  $$SELECT public.run_staff_time_clock_auto_signout()$$
);
