-- Daily Health Center overnight log email (directors only, 4:00 AM Eastern during EDT).

INSERT INTO public.automated_email_config (company_id, email_type, recipient_tags, enabled, send_timing)
SELECT
  c.id,
  'health_center_overnight_log',
  ARRAY['director']::text[],
  true,
  ARRAY[]::text[]
FROM public.companies c
WHERE c.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.automated_email_config aec
    WHERE aec.company_id = c.id AND aec.email_type = 'health_center_overnight_log'
  );

CREATE OR REPLACE FUNCTION public.run_daily_health_center_overnight_log()
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
    url := v_url || '/functions/v1/send-daily-health-center-log',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    )
  ) INTO v_req_id;
END;
$$;

DO $$
DECLARE
  job record;
BEGIN
  FOR job IN
    SELECT jobid FROM cron.job WHERE jobname = 'send-daily-health-center-overnight-log-cron'
  LOOP
    PERFORM cron.unschedule(job.jobid);
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

-- 4:00 AM Eastern during EDT (8:00 UTC)
SELECT cron.schedule(
  'send-daily-health-center-overnight-log-cron',
  '0 8 * * *',
  $$SELECT public.run_daily_health_center_overnight_log()$$
);
