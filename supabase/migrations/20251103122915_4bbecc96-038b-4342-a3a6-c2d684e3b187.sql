-- Update assign_default_role to include company_id
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.user_roles (user_id, role, company_id)
  VALUES (
    NEW.id, 
    'viewer',
    (NEW.raw_user_meta_data->>'company_id')::uuid
  );
  RETURN NEW;
END;
$function$;