-- Update handle_new_user to support auto-approval via metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, approved, approval_requested_at, company_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    NEW.email,
    -- Auto-approve if created with approved flag in metadata, otherwise require approval
    COALESCE((NEW.raw_user_meta_data->>'approved')::boolean, false),
    NOW(),
    (NEW.raw_user_meta_data->>'company_id')::uuid
  );
  RETURN NEW;
END;
$function$;