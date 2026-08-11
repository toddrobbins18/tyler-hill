-- Sunshine Report: grants + multi-camp RLS (camp switcher / super admin)
-- Without this, users viewing North Shore see empty groups even after seeding.

GRANT SELECT, INSERT, UPDATE, DELETE ON public.sunshine_groups TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sunshine_campers TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sunshine_tag_options TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sunshine_reports TO authenticated;

GRANT ALL ON public.sunshine_groups TO service_role;
GRANT ALL ON public.sunshine_campers TO service_role;
GRANT ALL ON public.sunshine_tag_options TO service_role;
GRANT ALL ON public.sunshine_reports TO service_role;

CREATE OR REPLACE FUNCTION public.user_can_manage_sunshine_data(
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
  DROP POLICY IF EXISTS "Users can manage sunshine_groups" ON public.sunshine_groups;
  DROP POLICY IF EXISTS "Users can manage sunshine_campers" ON public.sunshine_campers;
  DROP POLICY IF EXISTS "Users can manage sunshine_tag_options" ON public.sunshine_tag_options;
  DROP POLICY IF EXISTS "Users can manage sunshine_reports" ON public.sunshine_reports;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Users can manage sunshine_groups"
  ON public.sunshine_groups
  FOR ALL
  USING (public.user_can_manage_sunshine_data(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_sunshine_data(auth.uid(), company_id));

CREATE POLICY "Users can manage sunshine_campers"
  ON public.sunshine_campers
  FOR ALL
  USING (public.user_can_manage_sunshine_data(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_sunshine_data(auth.uid(), company_id));

CREATE POLICY "Users can manage sunshine_tag_options"
  ON public.sunshine_tag_options
  FOR ALL
  USING (public.user_can_manage_sunshine_data(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_sunshine_data(auth.uid(), company_id));

CREATE POLICY "Users can manage sunshine_reports"
  ON public.sunshine_reports
  FOR ALL
  USING (public.user_can_manage_sunshine_data(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_sunshine_data(auth.uid(), company_id));
