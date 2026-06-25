-- Add appointments email type to automated_email_config for all companies that don't have it yet
INSERT INTO public.automated_email_config (company_id, email_type, recipient_tags, enabled, send_timing)
SELECT 
  c.id as company_id,
  'appointment' as email_type,
  ARRAY['nurse']::text[] as recipient_tags,
  true as enabled,
  ARRAY['on_create', 'day_before']::text[] as send_timing
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.automated_email_config aec 
  WHERE aec.company_id = c.id AND aec.email_type = 'appointment'
);

-- Create database trigger for appointments
CREATE OR REPLACE FUNCTION public.notify_appointment()
RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-appointment-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object(
      'appointment_id', NEW.id,
      'action', CASE WHEN TG_OP = 'INSERT' THEN 'create' ELSE 'update' END
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS notify_appointment_trigger ON public.appointments;
CREATE TRIGGER notify_appointment_trigger
  AFTER INSERT OR UPDATE ON public.appointments
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_appointment();
