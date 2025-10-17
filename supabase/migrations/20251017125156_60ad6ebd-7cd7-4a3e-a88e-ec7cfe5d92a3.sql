-- Fix search_path for the roster template trigger function
CREATE OR REPLACE FUNCTION public.update_roster_template_updated_at()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;