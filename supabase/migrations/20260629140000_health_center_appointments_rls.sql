-- Health center (and staff/specialist) must create/edit appointments, not only admins.
-- Uses user_roles.company_id via user_has_role_for_company (same pattern as incident_reports).

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

CREATE OR REPLACE FUNCTION public.user_can_manage_appointments(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_role_for_company(
    _user_id,
    _company_id,
    ARRAY['admin', 'staff', 'health_center', 'specialist']::app_role[]
  );
$$;

-- Menu access for nurses
UPDATE public.role_permissions
SET can_access = true
WHERE role = 'health_center'::app_role
  AND menu_item = 'appointments';

INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT c.id, 'health_center'::app_role, 'appointments', true
FROM public.companies c
WHERE COALESCE(c.is_active, true) = true
ON CONFLICT (company_id, role, menu_item)
DO UPDATE SET can_access = EXCLUDED.can_access;

-- Replace fragmented / conflicting appointment policies
DROP POLICY IF EXISTS "Users can view appointments for their company" ON public.appointments;
DROP POLICY IF EXISTS "Users can select appointments for their company" ON public.appointments;
DROP POLICY IF EXISTS "Users can manage appointments for their company" ON public.appointments;
DROP POLICY IF EXISTS "Users can insert appointments for their company" ON public.appointments;
DROP POLICY IF EXISTS "Users can update appointments for their company" ON public.appointments;
DROP POLICY IF EXISTS "Users can delete appointments for their company" ON public.appointments;

CREATE POLICY "appointments_select"
ON public.appointments
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.user_can_manage_appointments(auth.uid(), company_id)
  OR (
    company_id = public.get_user_company(auth.uid())
    AND public.has_role(auth.uid(), 'division_leader'::app_role)
    AND child_id IS NOT NULL
    AND public.can_access_child(child_id)
  )
  OR (
    company_id = public.get_user_company(auth.uid())
    AND public.has_role(auth.uid(), 'viewer'::app_role)
    AND child_id IS NOT NULL
    AND public.can_access_child(child_id)
  )
);

CREATE POLICY "appointments_insert"
ON public.appointments
FOR INSERT
TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.user_can_manage_appointments(auth.uid(), company_id)
);

CREATE POLICY "appointments_update"
ON public.appointments
FOR UPDATE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.user_can_manage_appointments(auth.uid(), company_id)
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.user_can_manage_appointments(auth.uid(), company_id)
);

CREATE POLICY "appointments_delete"
ON public.appointments
FOR DELETE
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.user_can_manage_appointments(auth.uid(), company_id)
);
