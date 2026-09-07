-- Swim lessons: fix multi-camp RLS so staff can schedule when viewing North Shore
-- (or any day camp) via the camp switcher, not only their profile home company.
-- Also adds WITH CHECK for INSERT; the original policy had USING only.

CREATE OR REPLACE FUNCTION public.user_can_manage_swim_lessons(
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
  DROP POLICY IF EXISTS "Users can manage swim lessons" ON public.swim_lessons;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Staff manage swim lessons by company"
  ON public.swim_lessons
  FOR ALL
  TO authenticated
  USING (public.user_can_manage_swim_lessons(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_swim_lessons(auth.uid(), company_id));
