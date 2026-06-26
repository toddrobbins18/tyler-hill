-- Create function to trigger daily tutoring/private lessons summary email
CREATE OR REPLACE FUNCTION public.run_daily_tutoring_summary_email()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_url text;
  v_key text;
  v_req_id bigint;
BEGIN
  SELECT decrypted_secret INTO v_url
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_URL';

  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

  IF v_url IS NULL THEN
    RAISE EXCEPTION 'Vault secret SUPABASE_URL is missing.';
  END IF;
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'Vault secret SUPABASE_SERVICE_ROLE_KEY is missing.';
  END IF;

  SELECT net.http_post(
    url := v_url || '/functions/v1/send-daily-tutoring-summary',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    ),
    body := '{}'::jsonb
  ) INTO v_req_id;
END;
$$;

-- Unschedule existing job only if it already exists
DO $$
DECLARE
  job record;
BEGIN
  FOR job IN
    SELECT jobid FROM cron.job WHERE jobname = 'daily-tutoring-summary'
  LOOP
    PERFORM cron.unschedule(job.jobid);
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

-- Schedule daily at 8:30 AM UTC (~4:30 AM Eastern during EDT)
SELECT cron.schedule(
  'daily-tutoring-summary',
  '30 8 * * *',
  $$SELECT public.run_daily_tutoring_summary_email()$$
);
