-- Restore super_admin bypass on children SELECT (regression from 20260605140000).
-- Tighten health_center_admissions so super admins still rely on client company filter.

CREATE OR REPLACE FUNCTION public.can_access_child(_child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.children c
      WHERE c.id = _child_id
        AND c.company_id = public.get_user_company(auth.uid())
        AND (
          public.has_role(auth.uid(), 'admin'::app_role)
          OR public.has_role(auth.uid(), 'staff'::app_role)
          OR public.has_role(auth.uid(), 'health_center'::app_role)
          OR public.has_role(auth.uid(), 'specialist'::app_role)
          OR (
            (
              public.has_role(auth.uid(), 'division_leader'::app_role)
              OR public.has_role(auth.uid(), 'viewer'::app_role)
            )
            AND (
              c.division_id = ANY(COALESCE(public.get_user_divisions(auth.uid()), ARRAY[]::uuid[]))
              OR public.user_can_access_child_person_id(c.person_id)
            )
          )
        )
    )
$$;

DROP POLICY IF EXISTS "Users can view children from their company" ON public.children;

CREATE POLICY "Users can view children from their company"
ON public.children
FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR (
    company_id = public.get_user_company(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'staff'::app_role)
      OR public.has_role(auth.uid(), 'health_center'::app_role)
      OR public.has_role(auth.uid(), 'specialist'::app_role)
      OR (
        (
          public.has_role(auth.uid(), 'division_leader'::app_role)
          OR public.has_role(auth.uid(), 'viewer'::app_role)
        )
        AND (
          division_id = ANY(COALESCE(public.get_user_divisions(auth.uid()), ARRAY[]::uuid[]))
          OR public.user_can_access_child_person_id(person_id)
        )
      )
    )
  )
);

-- Super admins switching camps must filter by currentCompany on the client;
-- RLS still allows read when company_id matches profile OR user is super_admin.
DROP POLICY IF EXISTS "Health center and admins can view health admissions" ON public.health_center_admissions;
DROP POLICY IF EXISTS "Users can view health admissions from their company" ON public.health_center_admissions;
DROP POLICY IF EXISTS "Users can view health center admissions from their company" ON public.health_center_admissions;

CREATE POLICY "Health center and admins can view health admissions"
ON public.health_center_admissions
FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR (
    company_id = public.get_user_company(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'health_center'::app_role)
    )
  )
);

-- Staff directory: include health_center role and treat null status as active.
DROP POLICY IF EXISTS "Users can view staff from their company" ON public.staff;

CREATE POLICY "Users can view staff from their company"
ON public.staff
FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR (
    company_id = public.get_user_company(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'staff'::app_role)
      OR public.has_role(auth.uid(), 'division_leader'::app_role)
      OR public.has_role(auth.uid(), 'specialist'::app_role)
      OR public.has_role(auth.uid(), 'viewer'::app_role)
      OR public.has_role(auth.uid(), 'health_center'::app_role)
    )
  )
);
