-- Allow division leaders and viewers to manage elective signups for campers they can access.

DROP POLICY IF EXISTS "Admins and staff can manage elective signups" ON public.elective_signups;
DROP POLICY IF EXISTS "Admins and super admins can insert elective signups" ON public.elective_signups;
DROP POLICY IF EXISTS "Admins and super admins can update elective signups" ON public.elective_signups;
DROP POLICY IF EXISTS "Admins and super admins can delete elective signups" ON public.elective_signups;

CREATE POLICY "Users can insert elective signups"
ON public.elective_signups FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    company_id = public.get_user_company(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'staff'::app_role)
      OR public.can_access_child(child_id)
    )
  )
);

CREATE POLICY "Users can update elective signups"
ON public.elective_signups FOR UPDATE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    company_id = public.get_user_company(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'staff'::app_role)
      OR public.can_access_child(child_id)
    )
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    company_id = public.get_user_company(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'staff'::app_role)
      OR public.can_access_child(child_id)
    )
  )
);

CREATE POLICY "Users can delete elective signups"
ON public.elective_signups FOR DELETE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    company_id = public.get_user_company(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'staff'::app_role)
      OR public.can_access_child(child_id)
    )
  )
);
