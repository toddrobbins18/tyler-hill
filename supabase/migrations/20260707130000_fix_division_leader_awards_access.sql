-- Division leaders (and other roster-scoped roles) can use the Awards page on web + mobile.
-- Ensures menu permissions, read access via can_access_child, and insert/update scoped to accessible children.

CREATE OR REPLACE FUNCTION public.user_has_awards_page_access(
  _user_id uuid,
  _company_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp
      ON rp.company_id = _company_id
     AND rp.role = ur.role
     AND rp.menu_item = 'awards'
     AND rp.can_access = true
    WHERE ur.user_id = _user_id
      AND ur.company_id = _company_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_manage_awards(
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
    OR public.user_has_awards_page_access(_user_id, _company_id)
    OR public.user_has_role_for_company(
      _user_id,
      _company_id,
      ARRAY[
        'admin',
        'staff',
        'health_center',
        'division_leader',
        'specialist',
        'viewer'
      ]::public.app_role[]
    )
    OR (
      _company_id = public.get_user_company(_user_id)
      AND (
        public.has_role(_user_id, 'admin'::public.app_role)
        OR public.has_role(_user_id, 'staff'::public.app_role)
        OR public.has_role(_user_id, 'health_center'::public.app_role)
        OR public.has_role(_user_id, 'division_leader'::public.app_role)
        OR public.has_role(_user_id, 'specialist'::public.app_role)
        OR public.has_role(_user_id, 'viewer'::public.app_role)
      )
    );
$$;

CREATE OR REPLACE FUNCTION public.user_can_write_award_for_child(
  _user_id uuid,
  _company_id uuid,
  _child_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id)
    OR (
      _company_id IS NOT NULL
      AND _child_id IS NOT NULL
      AND public.user_can_manage_awards(_user_id, _company_id)
      AND (
        public.has_role(_user_id, 'admin'::public.app_role)
        OR public.has_role(_user_id, 'staff'::public.app_role)
        OR public.has_role(_user_id, 'health_center'::public.app_role)
        OR public.can_access_child(_child_id)
      )
    );
$$;

DROP POLICY IF EXISTS "Users can view awards from their company" ON public.awards;

CREATE POLICY "Users can view awards from their company"
ON public.awards
FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR (
    company_id = public.get_user_company(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'staff'::app_role)
      OR public.has_role(auth.uid(), 'health_center'::app_role)
      OR (
        (
          public.has_role(auth.uid(), 'division_leader'::app_role)
          OR public.has_role(auth.uid(), 'viewer'::app_role)
          OR public.has_role(auth.uid(), 'specialist'::app_role)
        )
        AND child_id IS NOT NULL
        AND public.can_access_child(child_id)
      )
      OR (child_id IS NOT NULL AND public.can_access_award(child_id))
    )
  )
);

DROP POLICY IF EXISTS "Users can insert awards for their company" ON public.awards;

CREATE POLICY "Users can insert awards for their company"
ON public.awards
FOR INSERT
TO authenticated
WITH CHECK (
  public.user_can_write_award_for_child(auth.uid(), company_id, child_id)
);

DROP POLICY IF EXISTS "Users can update awards for their company" ON public.awards;

CREATE POLICY "Users can update awards for their company"
ON public.awards
FOR UPDATE
TO authenticated
USING (
  public.user_can_write_award_for_child(auth.uid(), company_id, child_id)
)
WITH CHECK (
  public.user_can_write_award_for_child(auth.uid(), company_id, child_id)
);

DROP POLICY IF EXISTS "Users can delete awards for their company" ON public.awards;

CREATE POLICY "Users can delete awards for their company"
ON public.awards
FOR DELETE
TO authenticated
USING (
  public.user_can_write_award_for_child(auth.uid(), company_id, child_id)
);

-- Match sidebar defaults: roster-scoped roles should see Awards in the app menu.
INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT c.id, r.role, 'awards', true
FROM public.companies c
CROSS JOIN unnest(ARRAY[
  'admin',
  'staff',
  'health_center',
  'division_leader',
  'specialist',
  'viewer'
]::public.app_role[]) AS r(role)
WHERE COALESCE(c.is_active, true) = true
ON CONFLICT (company_id, role, menu_item)
DO UPDATE SET can_access = true;
