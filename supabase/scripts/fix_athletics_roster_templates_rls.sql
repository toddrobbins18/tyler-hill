-- Allow athletics staff (specialist role, e.g. soccer director) to manage roster templates
-- and sports event rosters. Previous policies only allowed admin/staff.

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
    OR public.has_role(_user_id, 'specialist'::public.app_role);
$$;

-- roster_templates
DROP POLICY IF EXISTS "Users can view roster templates from their company" ON public.roster_templates;
DROP POLICY IF EXISTS "Admins can manage roster templates for their company" ON public.roster_templates;
DROP POLICY IF EXISTS "Admins and staff can manage roster templates" ON public.roster_templates;
DROP POLICY IF EXISTS "Everyone can view roster templates" ON public.roster_templates;

CREATE POLICY "Users can view roster templates from their company"
ON public.roster_templates
FOR SELECT
USING (
  company_id = public.get_user_company(auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Athletics staff can manage roster templates for their company"
ON public.roster_templates
FOR ALL
USING (
  (
    company_id = public.get_user_company(auth.uid())
    AND public.can_manage_athletics_data(auth.uid())
  )
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  (
    company_id = public.get_user_company(auth.uid())
    AND public.can_manage_athletics_data(auth.uid())
  )
  OR public.is_super_admin(auth.uid())
);

-- roster_template_children
DROP POLICY IF EXISTS "Users can view roster template children from their company" ON public.roster_template_children;
DROP POLICY IF EXISTS "Admins can manage roster template children for their company" ON public.roster_template_children;
DROP POLICY IF EXISTS "Admins and staff can manage roster template children" ON public.roster_template_children;
DROP POLICY IF EXISTS "Everyone can view roster template children" ON public.roster_template_children;

CREATE POLICY "Users can view roster template children from their company"
ON public.roster_template_children
FOR SELECT
USING (
  company_id = public.get_user_company(auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Athletics staff can manage roster template children for their company"
ON public.roster_template_children
FOR ALL
USING (
  (
    company_id = public.get_user_company(auth.uid())
    AND public.can_manage_athletics_data(auth.uid())
  )
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  (
    company_id = public.get_user_company(auth.uid())
    AND public.can_manage_athletics_data(auth.uid())
  )
  OR public.is_super_admin(auth.uid())
);

-- sports_event_roster (event roster saves from athletics dialog)
DROP POLICY IF EXISTS "Users can view sports rosters from their company" ON public.sports_event_roster;
DROP POLICY IF EXISTS "Admins can manage sports rosters for their company" ON public.sports_event_roster;
DROP POLICY IF EXISTS "Admins and staff can manage sports event rosters" ON public.sports_event_roster;
DROP POLICY IF EXISTS "Admins and staff can view sports event rosters" ON public.sports_event_roster;
DROP POLICY IF EXISTS "Users can view sports event roster from their company" ON public.sports_event_roster;

CREATE POLICY "Users can view sports rosters from their company"
ON public.sports_event_roster
FOR SELECT
USING (
  company_id = public.get_user_company(auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Athletics staff can manage sports rosters for their company"
ON public.sports_event_roster
FOR ALL
USING (
  (
    company_id = public.get_user_company(auth.uid())
    AND public.can_manage_athletics_data(auth.uid())
  )
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  (
    company_id = public.get_user_company(auth.uid())
    AND public.can_manage_athletics_data(auth.uid())
  )
  OR public.is_super_admin(auth.uid())
);

-- sports_event_staff (coach/ref assignments on events)
DROP POLICY IF EXISTS "Users can view sports event staff from their company" ON public.sports_event_staff;
DROP POLICY IF EXISTS "Admins can manage sports event staff for their company" ON public.sports_event_staff;
DROP POLICY IF EXISTS "Admins and staff can manage sports event staff" ON public.sports_event_staff;
DROP POLICY IF EXISTS "Everyone can view sports event staff" ON public.sports_event_staff;

CREATE POLICY "Users can view sports event staff from their company"
ON public.sports_event_staff
FOR SELECT
USING (
  company_id = public.get_user_company(auth.uid())
  OR public.is_super_admin(auth.uid())
);

CREATE POLICY "Athletics staff can manage sports event staff for their company"
ON public.sports_event_staff
FOR ALL
USING (
  (
    company_id = public.get_user_company(auth.uid())
    AND public.can_manage_athletics_data(auth.uid())
  )
  OR public.is_super_admin(auth.uid())
)
WITH CHECK (
  (
    company_id = public.get_user_company(auth.uid())
    AND public.can_manage_athletics_data(auth.uid())
  )
  OR public.is_super_admin(auth.uid())
);
