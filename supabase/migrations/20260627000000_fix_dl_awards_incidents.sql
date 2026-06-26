-- Fix role permissions for Division Leaders to access Awards and Incidents pages
INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT id, 'division_leader'::app_role, 'awards', true
FROM public.companies
ON CONFLICT (company_id, role, menu_item) 
DO UPDATE SET can_access = true;

INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT id, 'division_leader'::app_role, 'incidents', true
FROM public.companies
ON CONFLICT (company_id, role, menu_item) 
DO UPDATE SET can_access = true;

-- Update RLS for incident_reports so division_leaders can view incidents for their children
DROP POLICY IF EXISTS "Authorized roles can view incidents" ON public.incident_reports;

CREATE POLICY "Authorized roles can view incidents"
ON public.incident_reports
FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR (
    company_id = public.get_user_company(auth.uid()) 
    AND (
      public.has_role(auth.uid(), 'admin'::app_role) 
      OR public.has_role(auth.uid(), 'health_center'::app_role)
      OR public.has_role(auth.uid(), 'staff'::app_role)
      OR (
        (public.has_role(auth.uid(), 'division_leader'::app_role) OR public.has_role(auth.uid(), 'viewer'::app_role))
        AND child_id IS NOT NULL 
        AND public.can_access_child(child_id)
      )
    )
  )
);
