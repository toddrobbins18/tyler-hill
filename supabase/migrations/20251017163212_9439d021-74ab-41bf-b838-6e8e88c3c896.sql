-- Create audit_logs table to track all changes
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
  old_data JSONB,
  new_data JSONB,
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_table_name ON public.audit_logs(table_name);
CREATE INDEX IF NOT EXISTS idx_audit_logs_record_id ON public.audit_logs(record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_changed_at ON public.audit_logs(changed_at DESC);

-- Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create a generic function to log changes
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, table_name, record_id, action, old_data, new_data)
    VALUES (auth.uid(), TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD), NULL);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, table_name, record_id, action, old_data, new_data)
    VALUES (auth.uid(), TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW));
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, table_name, record_id, action, old_data, new_data)
    VALUES (auth.uid(), TG_TABLE_NAME, NEW.id, TG_OP, NULL, row_to_json(NEW));
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- Create triggers on key tables
CREATE TRIGGER audit_children
AFTER INSERT OR UPDATE OR DELETE ON public.children
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER audit_staff
AFTER INSERT OR UPDATE OR DELETE ON public.staff
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER audit_awards
AFTER INSERT OR UPDATE OR DELETE ON public.awards
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER audit_incident_reports
AFTER INSERT OR UPDATE OR DELETE ON public.incident_reports
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER audit_daily_notes
AFTER INSERT OR UPDATE OR DELETE ON public.daily_notes
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER audit_trips
AFTER INSERT OR UPDATE OR DELETE ON public.trips
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER audit_medication_logs
AFTER INSERT OR UPDATE OR DELETE ON public.medication_logs
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER audit_sports_calendar
AFTER INSERT OR UPDATE OR DELETE ON public.sports_calendar
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER audit_menu_items
AFTER INSERT OR UPDATE OR DELETE ON public.menu_items
FOR EACH ROW EXECUTE FUNCTION public.log_audit();

CREATE TRIGGER audit_special_meals
AFTER INSERT OR UPDATE OR DELETE ON public.special_meals
FOR EACH ROW EXECUTE FUNCTION public.log_audit();