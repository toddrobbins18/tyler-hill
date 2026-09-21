-- Swim program records: fix multi-camp RLS so staff can save when viewing North Shore
-- (or any day camp) via the camp switcher, not only their profile home company.

CREATE OR REPLACE FUNCTION public.user_can_manage_swim_program_records(
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

DO $$
BEGIN
  DROP POLICY IF EXISTS "Staff manage swim program records" ON public.swim_program_records;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Staff manage swim program records"
  ON public.swim_program_records
  FOR ALL
  TO authenticated
  USING (public.user_can_manage_swim_program_records(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_swim_program_records(auth.uid(), company_id));
