-- Create automated_email_config table
CREATE TABLE IF NOT EXISTS public.automated_email_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email_type TEXT NOT NULL UNIQUE,
  recipient_tags TEXT[] NOT NULL DEFAULT '{}',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.automated_email_config ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can manage email config"
ON public.automated_email_config
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated users can view email config"
ON public.automated_email_config
FOR SELECT
USING (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE TRIGGER update_automated_email_config_updated_at
  BEFORE UPDATE ON public.automated_email_config
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Insert default configurations
INSERT INTO public.automated_email_config (email_type, recipient_tags, enabled) VALUES
  ('incident_report', ARRAY['director', 'admin_staff'], true),
  ('missed_medication', ARRAY['director', 'admin_staff', 'nurse'], true),
  ('transportation_event', ARRAY['director', 'admin_staff', 'transportation'], true),
  ('health_center_admission', ARRAY['director', 'admin_staff', 'nurse'], true),
  ('health_center_checkout', ARRAY['director', 'admin_staff', 'nurse'], true),
  ('sports_event_update', ARRAY['director', 'admin_staff', 'division_leader', 'specialist'], true),
  ('trip_update', ARRAY['director', 'admin_staff', 'division_leader'], true),
  ('user_approval_request', ARRAY['director', 'admin_staff'], true)
ON CONFLICT (email_type) DO NOTHING;

-- Create notification function for incident reports
CREATE OR REPLACE FUNCTION public.notify_incident_report()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-incident-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object(
      'incident_id', NEW.id,
      'action', TG_OP
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for incident reports
CREATE TRIGGER incident_report_notification
  AFTER INSERT OR UPDATE ON public.incident_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_incident_report();

-- Create notification function for health center
CREATE OR REPLACE FUNCTION public.notify_health_center()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-health-center-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for health center admissions
CREATE TRIGGER health_center_notification
  AFTER INSERT OR UPDATE ON public.health_center_admissions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_health_center();

-- Create notification function for user approval
CREATE OR REPLACE FUNCTION public.notify_user_approval()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.approved = false AND NEW.approval_requested_at IS NOT NULL 
     AND (TG_OP = 'INSERT' OR OLD.approval_requested_at IS NULL) THEN
    PERFORM net.http_post(
      url := current_setting('app.settings.supabase_url') || '/functions/v1/send-user-approval-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
      ),
      body := jsonb_build_object(
        'user_id', NEW.id,
        'user_email', NEW.email,
        'user_name', NEW.full_name
      )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger for user approval requests
CREATE TRIGGER user_approval_notification
  AFTER INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_user_approval();