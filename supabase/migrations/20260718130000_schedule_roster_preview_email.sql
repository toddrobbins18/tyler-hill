-- Migration to schedule the roster preview email for division leaders.

-- Collapses suffixes like "A", "B", "1", "2" so that division leaders for "Freshman A" 
-- can see "Freshman B" and "Freshman" (canonical) campers.
CREATE OR REPLACE FUNCTION public.normalize_division_name_for_filter(name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(COALESCE(name, ''), '\mSuper\s+Senior\M', 'Super', 'gi'),
        '\mTN\d+\M', '', 'gi'
      ),
      '\s+[A-Z0-9]\M', '', 'g'
    ),
    '\s+', ' ', 'g'
  )));
$$;

-- Ensure the email type exists in the config (optional but good practice if we want to manage it via UI later)
INSERT INTO public.automated_email_config (company_id, email_type, recipient_tags, enabled, send_timing)
SELECT 
  c.id, 
  'roster_preview', 
  ARRAY['division_leader']::text[], 
  true, 
  ARRAY['on_schedule']::text[]
FROM public.companies c
WHERE c.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.automated_email_config aec 
    WHERE aec.company_id = c.id AND aec.email_type = 'roster_preview'
  );

CREATE OR REPLACE FUNCTION public.run_send_tomorrow_rosters()
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
    url := v_url || '/functions/v1/send-tomorrow-rosters',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_key
    )
  ) INTO v_req_id;
END;
$$;

-- Unschedule existing job if recreating
DO $$
DECLARE
  job record;
BEGIN
  FOR job IN
    SELECT jobid FROM cron.job
    WHERE jobname = 'send-tomorrow-rosters-cron'
  LOOP
    PERFORM cron.unschedule(job.jobid);
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END;
$$;

-- Schedule to run at 8:00 PM Eastern (0:00 UTC) every day
SELECT cron.schedule(
  'send-tomorrow-rosters-cron',
  '0 0 * * *',
  $$SELECT public.run_send_tomorrow_rosters()$$
);
