-- create-user failed with duplicate key on user_roles (user_id, company_id).
-- assign_default_role inserted viewer when company_id was in auth metadata;
-- create-user then inserted the admin-selected role for the same user+company.

CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  target_company_id uuid;
  invited_role text;
BEGIN
  target_company_id := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'company_id', '')), '')::uuid;
  invited_role := NULLIF(trim(COALESCE(NEW.raw_user_meta_data->>'invited_role', '')), '');

  -- Admin create-user / invitations: role is assigned explicitly (edge function or user approval).
  IF target_company_id IS NOT NULL OR invited_role IS NOT NULL THEN
    RETURN NEW;
  END IF;

  -- Self-signup with no company: user approval flow assigns company + role later.
  RETURN NEW;
END;
$function$;
