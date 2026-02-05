-- Add tshirt_size column to children table
ALTER TABLE public.children 
ADD COLUMN IF NOT EXISTS tshirt_size text;

-- Add tshirt_size column to staff table
ALTER TABLE public.staff 
ADD COLUMN IF NOT EXISTS tshirt_size text;

-- Create user notification preferences table
CREATE TABLE public.user_notification_preferences (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  notification_type text NOT NULL,
  enabled boolean DEFAULT true,
  timing_options jsonb DEFAULT '[]'::jsonb,
  delivery_methods jsonb DEFAULT '["email"]'::jsonb,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, company_id, notification_type)
);

-- Enable RLS
ALTER TABLE public.user_notification_preferences ENABLE ROW LEVEL SECURITY;

-- Users can view and manage their own preferences
CREATE POLICY "Users can manage their own notification preferences"
ON public.user_notification_preferences
FOR ALL
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Admins can view all preferences in their company
CREATE POLICY "Admins can view notification preferences in their company"
ON public.user_notification_preferences
FOR SELECT
USING (
  (company_id = get_user_company(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  OR is_super_admin(auth.uid())
);

-- Create trigger for updated_at
CREATE TRIGGER update_user_notification_preferences_updated_at
BEFORE UPDATE ON public.user_notification_preferences
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();