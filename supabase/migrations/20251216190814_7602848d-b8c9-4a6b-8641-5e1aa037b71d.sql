-- Update the assign_default_role function to skip if company_id is null
-- or if a role already exists (to avoid conflict with create-user edge function)
CREATE OR REPLACE FUNCTION public.assign_default_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  target_company_id uuid;
BEGIN
  -- Get company_id from user metadata
  target_company_id := (NEW.raw_user_meta_data->>'company_id')::uuid;
  
  -- Skip if no company_id (edge function will handle role assignment)
  IF target_company_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Only insert if no role exists yet (avoid conflict with edge function)
  INSERT INTO public.user_roles (user_id, role, company_id)
  SELECT NEW.id, 'viewer', target_company_id
  WHERE NOT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = NEW.id
  );
  
  RETURN NEW;
END;
$function$;