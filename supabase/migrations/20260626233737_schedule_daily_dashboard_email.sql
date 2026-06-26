-- Create function to trigger daily dashboard email
CREATE OR REPLACE FUNCTION public.run_daily_dashboard_email()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url text;
  v_key text;
  v_req_id bigint;
BEGIN
  -- 1. Read the deployed Edge Function URL from vault
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_URL';

  -- 2. Read the Service Role Key from vault
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

  IF v_url IS NULL THEN
    RAISE EXCEPTION 'Vault secret SUPABASE_URL is missing.';
  END IF;
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'Vault secret SUPABASE_SERVICE_ROLE_KEY is missing.';
  END IF;

  -- 3. Perform a POST request to our Edge Function
  SELECT net.http_post(
    url := v_url || '/functions/v1/send-daily-dashboard',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    )
  ) INTO v_req_id;
END;
$$;

-- Unschedule any existing job if we are recreating
DO $$
DECLARE
  job record;
BEGIN
  FOR job IN
    SELECT jobid FROM cron.job WHERE jobname = 'send-daily-dashboard-cron'
  LOOP
    PERFORM cron.unschedule(job.jobid);
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

-- Schedule the job to run at 8:00 AM UTC (4:00 AM Eastern Time during EDT)
SELECT cron.schedule(
  'send-daily-dashboard-cron',
  '0 8 * * *',
  $$SELECT public.run_daily_dashboard_email()$$
);
