-- Bunking boards: allow save/load when user has role for the viewed camp (not only profile company).

CREATE OR REPLACE FUNCTION public.user_can_manage_bunking_boards(
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

DROP POLICY IF EXISTS "Users can manage bunking boards" ON public.bunking_boards;

CREATE POLICY "Users can manage bunking boards"
  ON public.bunking_boards
  FOR ALL
  TO authenticated
  USING (public.user_can_manage_bunking_boards(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_bunking_boards(auth.uid(), company_id));
