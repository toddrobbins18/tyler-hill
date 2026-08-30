-- Parent Portal: multi-camp RLS for staff admin dashboard
-- Run in Supabase SQL Editor when Portal Dashboard returns empty / permission errors
-- for North Shore viewed via camp switcher.

CREATE OR REPLACE FUNCTION public.user_can_manage_parent_portal_data(
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
  DROP POLICY IF EXISTS "Staff manage families by company" ON public.families;
  DROP POLICY IF EXISTS "Staff manage family children by company" ON public.family_children;
  DROP POLICY IF EXISTS "Staff manage pickup changes by company" ON public.pickup_changes;
  DROP POLICY IF EXISTS "Staff manage absences by company" ON public.absences;
  DROP POLICY IF EXISTS "Staff manage authorized pickups by company" ON public.authorized_pickups;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Staff manage families by company" ON public.families
  FOR ALL TO authenticated
  USING (public.user_can_manage_parent_portal_data(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_parent_portal_data(auth.uid(), company_id));

CREATE POLICY "Staff manage family children by company" ON public.family_children
  FOR ALL TO authenticated
  USING (public.user_can_manage_parent_portal_data(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_parent_portal_data(auth.uid(), company_id));

CREATE POLICY "Staff manage pickup changes by company" ON public.pickup_changes
  FOR ALL TO authenticated
  USING (public.user_can_manage_parent_portal_data(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_parent_portal_data(auth.uid(), company_id));

CREATE POLICY "Staff manage absences by company" ON public.absences
  FOR ALL TO authenticated
  USING (public.user_can_manage_parent_portal_data(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_parent_portal_data(auth.uid(), company_id));

CREATE POLICY "Staff manage authorized pickups by company" ON public.authorized_pickups
  FOR ALL TO authenticated
  USING (public.user_can_manage_parent_portal_data(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_parent_portal_data(auth.uid(), company_id));
