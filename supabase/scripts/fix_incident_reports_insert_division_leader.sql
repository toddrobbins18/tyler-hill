-- Allow division leaders and specialists to insert incident reports
DROP POLICY IF EXISTS "incident_reports_insert" ON public.incident_reports;
CREATE POLICY "incident_reports_insert"
ON public.incident_reports
FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    company_id IS NOT NULL
    AND public.user_has_role_for_company(
      auth.uid(),
      company_id,
      ARRAY['admin', 'staff', 'health_center', 'division_leader', 'specialist']::app_role[]
    )
  )
);

-- Allow division leaders and specialists to link children to incidents they create
DROP POLICY IF EXISTS "incident_children_insert" ON public.incident_children;
CREATE POLICY "incident_children_insert"
ON public.incident_children
FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.can_manage_incident_children(incident_children.incident_id)
  OR (
    public.can_access_child(child_id)
    AND EXISTS (
      SELECT 1 FROM incident_reports ir
      WHERE ir.id = incident_id
      AND public.user_has_role_for_company(
        auth.uid(),
        ir.company_id,
        ARRAY['division_leader', 'specialist']::app_role[]
      )
    )
  )
);
