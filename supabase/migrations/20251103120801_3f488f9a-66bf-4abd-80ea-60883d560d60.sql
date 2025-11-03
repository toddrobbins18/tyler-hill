-- Update handle_new_user function to extract company_id from signup metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, approved, approval_requested_at, company_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    false,
    NOW(),
    -- Extract company_id from signup metadata
    (NEW.raw_user_meta_data->>'company_id')::uuid
  );
  RETURN NEW;
END;
$function$;