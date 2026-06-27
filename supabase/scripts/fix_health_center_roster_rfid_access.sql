-- Nurses (health_center) need roster + staff menu access and must read campers/staff
-- for wristband lookup in Health Center (web + mobile). Also supports multi-camp role rows.

CREATE OR REPLACE FUNCTION public.user_has_role_for_company(
  _user_id uuid,
  _company_id uuid,
  _roles app_role[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.company_id = _company_id
        AND ur.role = ANY(_roles)
    );
$$;

-- Menu: roster (campers), staff (staff wristbands), dashboard, nurse
UPDATE public.role_permissions
SET can_access = true
WHERE role = 'health_center'::app_role
  AND menu_item IN ('roster', 'staff', 'dashboard', 'nurse', 'incidents', 'appointments');

INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT c.id, 'health_center'::app_role, mi.menu_item, true
FROM public.companies c
CROSS JOIN (
  VALUES ('roster'), ('staff'), ('dashboard'), ('nurse'), ('incidents'), ('appointments')
) AS mi(menu_item)
WHERE COALESCE(c.is_active, true) = true
ON CONFLICT (company_id, role, menu_item)
DO UPDATE SET can_access = EXCLUDED.can_access;

DROP POLICY IF EXISTS "Users can view children from their company" ON public.children;

CREATE POLICY "Users can view children from their company"
ON public.children
FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR (
    (
      company_id = public.get_user_company(auth.uid())
      OR public.user_has_role_for_company(
        auth.uid(),
        company_id,
        ARRAY['admin', 'staff', 'health_center', 'specialist']::app_role[]
      )
    )
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
          public.user_can_access_division_id(division_id)
          OR public.normalize_person_id_for_match(person_id) = ANY(
            COALESCE(public.get_user_accessible_person_ids(auth.uid()), ARRAY[]::text[])
          )
        )
      )
    )
  )
);

DROP POLICY IF EXISTS "Users can view staff from their company" ON public.staff;

CREATE POLICY "Users can view staff from their company"
ON public.staff
FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR (
    (
      company_id = public.get_user_company(auth.uid())
      OR public.user_has_role_for_company(
        auth.uid(),
        company_id,
        ARRAY['admin', 'staff', 'health_center', 'specialist', 'division_leader', 'viewer']::app_role[]
      )
    )
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
