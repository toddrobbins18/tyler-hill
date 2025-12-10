-- Schedule hourly CampMinder sync for all enabled companies
-- The cron job will call the sync-campminder edge function every hour

-- First, ensure pg_cron is enabled in pg_catalog schema
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Grant usage on cron schema
GRANT USAGE ON SCHEMA cron TO postgres;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA cron TO postgres;

-- Create a function to trigger CampMinder sync via pg_net
CREATE OR REPLACE FUNCTION public.trigger_campminder_sync()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
BEGIN
  -- Get secrets from vault
  SELECT decrypted_secret INTO supabase_url 
  FROM vault.decrypted_secrets 
  WHERE name = 'SUPABASE_URL';
  
  SELECT decrypted_secret INTO service_role_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';
  
  -- If vault secrets not available, use env vars pattern
  IF supabase_url IS NULL THEN
    supabase_url := 'https://gdcxtefbarvnrtvacqln.supabase.co';
  END IF;
  
  -- Call the edge function for each company with CampMinder enabled
  PERFORM extensions.http_post(
    url := supabase_url || '/functions/v1/sync-campminder',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, current_setting('app.settings.service_role_key', true))
    ),
    body := jsonb_build_object('sync_all', true)
  );
  
  RAISE NOTICE 'CampMinder sync triggered at %', NOW();
END;
$$;

-- Schedule the sync to run every hour at minute 0
SELECT cron.schedule(
  'campminder-hourly-sync',
  '0 * * * *',  -- Every hour at minute 0
  $$SELECT public.trigger_campminder_sync()$$
);