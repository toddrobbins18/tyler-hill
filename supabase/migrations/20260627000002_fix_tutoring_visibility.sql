-- Fix role permissions for Division Leaders, Specialists, Viewers to access Tutoring & Therapy
INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT id, 'division_leader'::app_role, 'tutoring-therapy', true FROM public.companies
ON CONFLICT (company_id, role, menu_item) DO UPDATE SET can_access = true;

INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT id, 'specialist'::app_role, 'tutoring-therapy', true FROM public.companies
ON CONFLICT (company_id, role, menu_item) DO UPDATE SET can_access = true;

INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT id, 'viewer'::app_role, 'tutoring-therapy', true FROM public.companies
ON CONFLICT (company_id, role, menu_item) DO UPDATE SET can_access = true;

-- Make sure RLS for tutoring_therapy allows viewing by these roles
DROP POLICY IF EXISTS "Authorized users can view tutoring_therapy" ON public.tutoring_therapy;

CREATE POLICY "Authorized users can view tutoring_therapy"
ON public.tutoring_therapy FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR (
    company_id = public.get_user_company(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'staff'::app_role)
      OR public.has_role(auth.uid(), 'health_center'::app_role)
      OR (
        (public.has_role(auth.uid(), 'division_leader'::app_role) OR public.has_role(auth.uid(), 'viewer'::app_role))
        AND public.can_access_child(child_id)
      )
    )
  )
);
