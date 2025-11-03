-- Update handle_new_user to conditionally set approval_requested_at
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  is_approved boolean;
BEGIN
  is_approved := COALESCE((NEW.raw_user_meta_data->>'approved')::boolean, false);
  
  INSERT INTO public.profiles (id, full_name, email, approved, approval_requested_at, company_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    is_approved,
    -- Only set approval_requested_at if user needs approval
    CASE WHEN is_approved THEN NULL ELSE NOW() END,
    (NEW.raw_user_meta_data->>'company_id')::uuid
  );
  RETURN NEW;
END;
$function$;