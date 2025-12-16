-- Fix notify_user_approval function
CREATE OR REPLACE FUNCTION public.notify_user_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  service_role_key text;
BEGIN
  IF NEW.approved = false AND NEW.approval_requested_at IS NOT NULL 
     AND (TG_OP = 'INSERT' OR OLD.approval_requested_at IS NULL) THEN
    
    -- Get service role key from vault
    SELECT decrypted_secret INTO service_role_key 
    FROM vault.decrypted_secrets 
    WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';
    
    PERFORM net.http_post(
      url := 'https://gdcxtefbarvnrtvacqln.supabase.co/functions/v1/send-user-approval-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(service_role_key, '')
      ),
      body := jsonb_build_object(
        'user_id', NEW.id,
        'user_email', NEW.email,
        'user_name', NEW.full_name
      )
    );
  END IF;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_user_approval failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- Fix notify_health_center function
CREATE OR REPLACE FUNCTION public.notify_health_center()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  service_role_key text;
BEGIN
  -- Get service role key from vault
  SELECT decrypted_secret INTO service_role_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

  PERFORM net.http_post(
    url := 'https://gdcxtefbarvnrtvacqln.supabase.co/functions/v1/send-health-center-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, '')
    ),
    body := jsonb_build_object(
      'admission_id', NEW.id,
      'action', TG_OP,
      'event_type', CASE 
        WHEN NEW.checked_out_at IS NOT NULL AND (OLD.checked_out_at IS NULL OR TG_OP = 'INSERT')
        THEN 'checkout' 
        ELSE 'admission' 
      END
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_health_center failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- Fix notify_incident_report function
CREATE OR REPLACE FUNCTION public.notify_incident_report()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  service_role_key text;
BEGIN
  -- Get service role key from vault
  SELECT decrypted_secret INTO service_role_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

  PERFORM net.http_post(
    url := 'https://gdcxtefbarvnrtvacqln.supabase.co/functions/v1/send-incident-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, '')
    ),
    body := jsonb_build_object(
      'incident_id', NEW.id,
      'action', TG_OP
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_incident_report failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- Fix notify_sports_academy function
CREATE OR REPLACE FUNCTION public.notify_sports_academy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  service_role_key text;
BEGIN
  -- Get service role key from vault
  SELECT decrypted_secret INTO service_role_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

  PERFORM net.http_post(
    url := 'https://gdcxtefbarvnrtvacqln.supabase.co/functions/v1/send-sports-academy-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, '')
    ),
    body := jsonb_build_object(
      'enrollment_id', NEW.id,
      'action', TG_OP
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_sports_academy failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- Fix notify_tutoring_therapy function
CREATE OR REPLACE FUNCTION public.notify_tutoring_therapy()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  service_role_key text;
BEGIN
  -- Get service role key from vault
  SELECT decrypted_secret INTO service_role_key 
  FROM vault.decrypted_secrets 
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

  PERFORM net.http_post(
    url := 'https://gdcxtefbarvnrtvacqln.supabase.co/functions/v1/send-tutoring-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, '')
    ),
    body := jsonb_build_object(
      'enrollment_id', NEW.id,
      'action', TG_OP
    )
  );
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_tutoring_therapy failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;

-- Fix notify_sports_event function
CREATE OR REPLACE FUNCTION public.notify_sports_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  event_record record;
  service_role_key text;
BEGIN
  -- Only notify when status changes to 'approved' or when approved event is updated
  IF (NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved'))
     OR (NEW.status = 'approved' AND TG_OP = 'UPDATE' AND NEW.sports_event_id IS NOT NULL) THEN
    
    -- Get the sports event details
    SELECT * INTO event_record
    FROM sports_calendar
    WHERE id = NEW.sports_event_id;
    
    -- Get service role key from vault
    SELECT decrypted_secret INTO service_role_key 
    FROM vault.decrypted_secrets 
    WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';
    
    PERFORM net.http_post(
      url := 'https://gdcxtefbarvnrtvacqln.supabase.co/functions/v1/send-event-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || COALESCE(service_role_key, '')
      ),
      body := jsonb_build_object(
        'event_id', NEW.sports_event_id,
        'trip_id', NEW.id,
        'action', CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'updated' END
      )
    );
  END IF;
  
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_sports_event failed: %', SQLERRM;
  RETURN NEW;
END;
$function$;