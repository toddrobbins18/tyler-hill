-- Run in Supabase SQL Editor if swim lesson insert fails with RLS error.
-- Same as migration 20260907184000_fix_swim_lessons_rls_multi_camp.sql

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

DROP POLICY IF EXISTS "Users can manage swim lessons" ON public.swim_lessons;

CREATE POLICY "Staff manage swim lessons by company"
  ON public.swim_lessons
  FOR ALL
  TO authenticated
  USING (public.user_can_manage_swim_lessons(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_swim_lessons(auth.uid(), company_id));
