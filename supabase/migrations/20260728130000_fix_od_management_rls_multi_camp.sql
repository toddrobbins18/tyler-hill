-- Fix OD Management RLS for multi-camp users and super admins.
-- bunks / bunk_staff / staff_days_off previously required profiles.company_id only,
-- so switching camps in the UI returned zero rows.

CREATE OR REPLACE FUNCTION public.user_can_manage_od_data(
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
    OR public.user_has_role_for_company(
      _user_id,
      _company_id,
      ARRAY['admin', 'staff', 'specialist', 'division_leader']::public.app_role[]
    );
$$;

CREATE OR REPLACE FUNCTION public.user_can_view_od_company_data(
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
    OR public.user_has_role_for_company(
      _user_id,
      _company_id,
      ARRAY[
        'admin',
        'staff',
        'specialist',
        'division_leader',
        'viewer',
        'health_center'
      ]::public.app_role[]
    )
    OR _company_id = public.get_user_company(_user_id);
$$;

-- bunks
DROP POLICY IF EXISTS "Users can view bunks for their company" ON public.bunks;
DROP POLICY IF EXISTS "Users can manage bunks for their company" ON public.bunks;

CREATE POLICY "Users can view bunks for their company"
ON public.bunks
FOR SELECT
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.user_can_view_od_company_data(auth.uid(), company_id)
);

CREATE POLICY "Users can manage bunks for their company"
ON public.bunks
FOR ALL
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.user_can_manage_od_data(auth.uid(), company_id)
)
WITH CHECK (
  company_id IS NOT NULL
  AND public.user_can_manage_od_data(auth.uid(), company_id)
);

-- bunk_staff
DROP POLICY IF EXISTS "Users can view bunk_staff for their company" ON public.bunk_staff;
DROP POLICY IF EXISTS "Users can manage bunk_staff for their company" ON public.bunk_staff;

CREATE POLICY "Users can view bunk_staff for their company"
ON public.bunk_staff
FOR SELECT
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.user_can_view_od_company_data(auth.uid(), company_id)
);

CREATE POLICY "Users can manage bunk_staff for their company"
ON public.bunk_staff
FOR ALL
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.user_can_manage_od_data(auth.uid(), company_id)
)
WITH CHECK (
  company_id IS NOT NULL
  AND public.user_can_manage_od_data(auth.uid(), company_id)
);

-- staff_days_off
DROP POLICY IF EXISTS "Users can view staff_days_off for their company" ON public.staff_days_off;
DROP POLICY IF EXISTS "Users can manage staff_days_off for their company" ON public.staff_days_off;

CREATE POLICY "Users can view staff_days_off for their company"
ON public.staff_days_off
FOR SELECT
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.user_can_view_od_company_data(auth.uid(), company_id)
);

CREATE POLICY "Users can manage staff_days_off for their company"
ON public.staff_days_off
FOR ALL
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.user_can_manage_od_data(auth.uid(), company_id)
)
WITH CHECK (
  company_id IS NOT NULL
  AND public.user_can_manage_od_data(auth.uid(), company_id)
);
