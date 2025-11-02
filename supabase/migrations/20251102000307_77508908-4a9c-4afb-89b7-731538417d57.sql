-- Create function to set current company in session (for RLS context)
CREATE OR REPLACE FUNCTION public.set_current_company(company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- This function can be used to set session variables if needed in the future
  -- For now, it's a placeholder that the app can call
  RETURN;
END;
$$;