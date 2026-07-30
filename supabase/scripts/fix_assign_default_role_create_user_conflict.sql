-- Re-runnable: fix "duplicate key user_roles_user_id_company_id_key" when creating users from Admin Panel.
-- Run in Supabase SQL Editor, then retry Add User.

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
