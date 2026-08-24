-- Run in Supabase SQL Editor if Office Changes "Log" fails with:
--   new row violates row-level security policy for table "office_transport_changes"
-- Idempotent — safe to re-run.

CREATE OR REPLACE FUNCTION public.user_can_manage_office_transport_changes(
  _user_id uuid,
  _company_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id)
    OR _company_id = public.get_user_company(_user_id)
    OR public.user_has_role_for_company(
      _user_id,
      _company_id,
      ARRAY['admin', 'staff', 'division_leader']::public.app_role[]
    );
$$;

DROP POLICY IF EXISTS "Users can manage office transport changes" ON public.office_transport_changes;

CREATE POLICY "Users can manage office transport changes"
  ON public.office_transport_changes
  FOR ALL
  TO authenticated
  USING (public.user_can_manage_office_transport_changes(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_office_transport_changes(auth.uid(), company_id));
