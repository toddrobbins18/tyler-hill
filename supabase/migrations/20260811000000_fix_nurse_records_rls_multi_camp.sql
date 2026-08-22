-- Day camp Nurse (nurse_records / nurse_in_out): fix multi-camp RLS.
-- Previous policy used get_user_company() only, so inserts failed when the camp
-- switcher pointed at North Shore while the user's profile company was another camp.

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

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can manage nurse records" ON public.nurse_records;
  DROP POLICY IF EXISTS "Users can manage nurse in/out" ON public.nurse_in_out;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

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
