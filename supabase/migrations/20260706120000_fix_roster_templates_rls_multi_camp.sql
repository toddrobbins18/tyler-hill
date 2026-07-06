-- Fix roster template RLS for Timber Lake and multi-camp users.
-- Previous policies required company_id = profiles.company_id, which fails when an admin
-- switches camps or when athletics staff roles live in user_roles for a different company.

CREATE OR REPLACE FUNCTION public.user_can_manage_athletics_data(
  _user_id uuid,
  _company_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_role_for_company(
    _user_id,
    _company_id,
    ARRAY['admin', 'staff', 'specialist', 'division_leader']::public.app_role[]
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_view_athletics_company_data(
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

CREATE OR REPLACE FUNCTION public.can_manage_athletics_data(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin(_user_id)
    OR public.has_role(_user_id, 'admin'::public.app_role)
    OR public.has_role(_user_id, 'staff'::public.app_role)
    OR public.has_role(_user_id, 'specialist'::public.app_role)
    OR public.has_role(_user_id, 'division_leader'::public.app_role);
$$;

-- roster_templates
DROP POLICY IF EXISTS "Users can view roster templates from their company" ON public.roster_templates;
DROP POLICY IF EXISTS "Athletics staff can manage roster templates for their company" ON public.roster_templates;
DROP POLICY IF EXISTS "Admins can manage roster templates for their company" ON public.roster_templates;
DROP POLICY IF EXISTS "Admins and staff can manage roster templates" ON public.roster_templates;
DROP POLICY IF EXISTS "Everyone can view roster templates" ON public.roster_templates;

CREATE POLICY "Users can view roster templates from their company"
ON public.roster_templates
FOR SELECT
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.user_can_view_athletics_company_data(auth.uid(), company_id)
);

CREATE POLICY "Athletics staff can manage roster templates for their company"
ON public.roster_templates
FOR ALL
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.user_can_manage_athletics_data(auth.uid(), company_id)
)
WITH CHECK (
  company_id IS NOT NULL
  AND public.user_can_manage_athletics_data(auth.uid(), company_id)
);

-- roster_template_children
DROP POLICY IF EXISTS "Users can view roster template children from their company" ON public.roster_template_children;
DROP POLICY IF EXISTS "Athletics staff can manage roster template children for their company" ON public.roster_template_children;
DROP POLICY IF EXISTS "Admins can manage roster template children for their company" ON public.roster_template_children;
DROP POLICY IF EXISTS "Admins and staff can manage roster template children" ON public.roster_template_children;
DROP POLICY IF EXISTS "Everyone can view roster template children" ON public.roster_template_children;

CREATE POLICY "Users can view roster template children from their company"
ON public.roster_template_children
FOR SELECT
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.user_can_view_athletics_company_data(auth.uid(), company_id)
);

CREATE POLICY "Athletics staff can manage roster template children for their company"
ON public.roster_template_children
FOR ALL
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.user_can_manage_athletics_data(auth.uid(), company_id)
)
WITH CHECK (
  company_id IS NOT NULL
  AND public.user_can_manage_athletics_data(auth.uid(), company_id)
);

-- sports_event_roster (same multi-camp pattern)
DROP POLICY IF EXISTS "Users can view sports rosters from their company" ON public.sports_event_roster;
DROP POLICY IF EXISTS "Athletics staff can manage sports rosters for their company" ON public.sports_event_roster;
DROP POLICY IF EXISTS "Admins can manage sports rosters for their company" ON public.sports_event_roster;
DROP POLICY IF EXISTS "Admins and staff can manage sports event rosters" ON public.sports_event_roster;
DROP POLICY IF EXISTS "Admins and staff can view sports event rosters" ON public.sports_event_roster;
DROP POLICY IF EXISTS "Users can view sports event roster from their company" ON public.sports_event_roster;

CREATE POLICY "Users can view sports rosters from their company"
ON public.sports_event_roster
FOR SELECT
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.user_can_view_athletics_company_data(auth.uid(), company_id)
);

CREATE POLICY "Athletics staff can manage sports rosters for their company"
ON public.sports_event_roster
FOR ALL
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.user_can_manage_athletics_data(auth.uid(), company_id)
)
WITH CHECK (
  company_id IS NOT NULL
  AND public.user_can_manage_athletics_data(auth.uid(), company_id)
);

-- sports_event_staff
DROP POLICY IF EXISTS "Users can view sports event staff from their company" ON public.sports_event_staff;
DROP POLICY IF EXISTS "Athletics staff can manage sports event staff for their company" ON public.sports_event_staff;
DROP POLICY IF EXISTS "Admins can manage sports event staff for their company" ON public.sports_event_staff;
DROP POLICY IF EXISTS "Admins and staff can manage sports event staff" ON public.sports_event_staff;
DROP POLICY IF EXISTS "Everyone can view sports event staff" ON public.sports_event_staff;

CREATE POLICY "Users can view sports event staff from their company"
ON public.sports_event_staff
FOR SELECT
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.user_can_view_athletics_company_data(auth.uid(), company_id)
);

CREATE POLICY "Athletics staff can manage sports event staff for their company"
ON public.sports_event_staff
FOR ALL
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.user_can_manage_athletics_data(auth.uid(), company_id)
)
WITH CHECK (
  company_id IS NOT NULL
  AND public.user_can_manage_athletics_data(auth.uid(), company_id)
);
