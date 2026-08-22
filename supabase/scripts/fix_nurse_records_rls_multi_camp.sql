-- Run in Supabase SQL Editor if Nurse Dashboard "Add record" fails with:
--   new row violates row-level security policy for table "nurse_records"
-- Idempotent — safe to re-run.

CREATE OR REPLACE FUNCTION public.user_can_manage_nurse_records(
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
      ARRAY['admin', 'staff', 'health_center']::public.app_role[]
    );
$$;

DROP POLICY IF EXISTS "Users can manage nurse records" ON public.nurse_records;
DROP POLICY IF EXISTS "Users can manage nurse in/out" ON public.nurse_in_out;

CREATE POLICY "Users can manage nurse records"
  ON public.nurse_records
  FOR ALL
  TO authenticated
  USING (public.user_can_manage_nurse_records(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_nurse_records(auth.uid(), company_id));

CREATE POLICY "Users can manage nurse in/out"
  ON public.nurse_in_out
  FOR ALL
  TO authenticated
  USING (public.user_can_manage_nurse_records(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_nurse_records(auth.uid(), company_id));
