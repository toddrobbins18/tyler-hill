-- Phase 1: Database Migrations for Notification System

-- 1. Standardize staff departments
UPDATE staff 
SET department = 'Health Center' 
WHERE department = 'Specalist' OR department ILIKE '%health%' OR department ILIKE '%nurse%';

UPDATE staff 
SET department = 'Food Services' 
WHERE department ILIKE '%food%' OR department ILIKE '%kitchen%';

-- 2. Create notification_logs table to track sent notifications
CREATE TABLE IF NOT EXISTS public.notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid REFERENCES public.sports_calendar(id) ON DELETE CASCADE,
  trip_id uuid REFERENCES public.trips(id) ON DELETE CASCADE,
  event_type text NOT NULL CHECK (event_type IN ('home', 'away')),
  notification_version integer DEFAULT 1,
  sent_at timestamp with time zone DEFAULT now(),
  recipient_count integer NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on notification_logs
ALTER TABLE public.notification_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for notification_logs
CREATE POLICY "Admins and staff can view notification logs"
ON public.notification_logs
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "System can insert notification logs"
ON public.notification_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 3. Create function to handle notification triggers
CREATE OR REPLACE FUNCTION public.notify_sports_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_record record;
BEGIN
  -- Only notify when status changes to 'approved' or when approved event is updated
  IF (NEW.status = 'approved' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'approved'))
     OR (NEW.status = 'approved' AND TG_OP = 'UPDATE' AND NEW.sports_event_id IS NOT NULL) THEN
    
    -- Get the sports event details
    SELECT * INTO event_record
    FROM sports_calendar
    WHERE id = NEW.sports_event_id;
    
    -- Call edge function via HTTP post (using pg_net extension)
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-event-notifications',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'event_id', NEW.sports_event_id,
        'trip_id', NEW.id,
        'action', CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'updated' END
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- 4. Create trigger on trips table
DROP TRIGGER IF EXISTS on_trip_approved ON public.trips;

CREATE TRIGGER on_trip_approved
  AFTER INSERT OR UPDATE ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_sports_event();