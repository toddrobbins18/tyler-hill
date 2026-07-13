-- Division leaders (and viewers) can read nurse data for campers in their assigned divisions.
-- Menu access + client-side filtering were already in place; RLS was still admin/health_center only
-- since 20251207123405. Mirrors appointments_select (20260629140000).

-- medication_logs: division-scoped read for DL/viewer; manage stays admin/health_center only.
DROP POLICY IF EXISTS "Health center and admins can view medication logs" ON public.medication_logs;

CREATE POLICY "Health center and admins can view medication logs"
ON public.medication_logs
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
  OR (
    company_id = public.get_user_company(auth.uid())
    AND child_id IS NOT NULL
    AND public.can_access_child(child_id)
    AND (
      public.has_role(auth.uid(), 'division_leader'::app_role)
      OR public.has_role(auth.uid(), 'viewer'::app_role)
    )
  )
);

-- health_center_admissions: same for camper admissions (staff-only admissions stay restricted).
DROP POLICY IF EXISTS "Health center and admins can view health admissions" ON public.health_center_admissions;

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
  OR (
    company_id = public.get_user_company(auth.uid())
    AND child_id IS NOT NULL
    AND public.can_access_child(child_id)
    AND (
      public.has_role(auth.uid(), 'division_leader'::app_role)
      OR public.has_role(auth.uid(), 'viewer'::app_role)
    )
  )
);

-- Admission notes: scope reads to admissions the user can already see.
DROP POLICY IF EXISTS "Users can view health center admission notes" ON public.health_center_admission_notes;

CREATE POLICY "Users can view health center admission notes"
ON public.health_center_admission_notes
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
  OR EXISTS (
    SELECT 1
    FROM public.health_center_admissions hca
    WHERE hca.id = admission_id
      AND hca.company_id = public.get_user_company(auth.uid())
      AND hca.child_id IS NOT NULL
      AND public.can_access_child(hca.child_id)
      AND (
        public.has_role(auth.uid(), 'division_leader'::app_role)
        OR public.has_role(auth.uid(), 'viewer'::app_role)
      )
  )
);

-- Ensure division leaders can open the Nurse page (some camps had nurse=false from defaults).
INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT c.id, 'division_leader'::public.app_role, 'nurse', true
FROM public.companies c
WHERE COALESCE(c.is_active, true) = true
ON CONFLICT (company_id, role, menu_item)
DO UPDATE SET can_access = true;
