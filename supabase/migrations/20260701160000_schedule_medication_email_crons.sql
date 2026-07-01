-- Schedule medication generation + missed-medication alert emails.
-- Uses Vault secrets (same pattern as daily dashboard cron).

CREATE OR REPLACE FUNCTION public.run_generate_daily_medications()
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
    url := v_url || '/functions/v1/generate-daily-medications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    )
  ) INTO v_req_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.run_check_medication_alerts()
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
    url := v_url || '/functions/v1/check-medication-alerts',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    )
  ) INTO v_req_id;
END;
$$;

-- Ensure every active camp has missed_medication recipients configured.
INSERT INTO public.automated_email_config (company_id, email_type, recipient_tags, enabled, send_timing)
SELECT
  c.id,
  'missed_medication',
  ARRAY['director', 'admin_staff', 'nurse']::text[],
  true,
  ARRAY['on_create']::text[]
FROM public.companies c
WHERE c.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.automated_email_config aec
    WHERE aec.company_id = c.id AND aec.email_type = 'missed_medication'
  );

-- Unschedule existing jobs if recreating
DO $$
DECLARE
  job record;
BEGIN
  FOR job IN
    SELECT jobid FROM cron.job
    WHERE jobname IN ('generate-daily-medications-cron', 'check-medication-alerts-cron')
  LOOP
    PERFORM cron.unschedule(job.jobid);
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

-- 5:00 AM Eastern (9:00 UTC during EDT) — materialize today's med rows
SELECT cron.schedule(
  'generate-daily-medications-cron',
  '0 9 * * *',
  $$SELECT public.run_generate_daily_medications()$$
);

-- Every 15 minutes — check for meds past scheduled time
SELECT cron.schedule(
  'check-medication-alerts-cron',
  '*/15 * * * *',
  $$SELECT public.run_check_medication_alerts()$$
);
