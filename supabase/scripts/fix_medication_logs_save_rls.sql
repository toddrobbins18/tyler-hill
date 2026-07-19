-- Run in Supabase SQL editor if migration 20260719120000_fix_medication_logs_save_rls was not applied via CLI.
-- Fixes medication insert/update 403s when get_user_company() does not match profiles.company_id.

DROP POLICY IF EXISTS "Health center and admins can view medication logs" ON public.medication_logs;

CREATE POLICY "Health center and admins can view medication logs"
ON public.medication_logs
FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR (
    (
      company_id = public.get_user_company(auth.uid())
      OR company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
    )
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'health_center'::app_role)
    )
  )
  OR (
    (
      company_id = public.get_user_company(auth.uid())
      OR company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
    )
    AND child_id IS NOT NULL
    AND public.can_access_child(child_id)
    AND (
      public.has_role(auth.uid(), 'division_leader'::app_role)
      OR public.has_role(auth.uid(), 'viewer'::app_role)
    )
  )
);

DROP POLICY IF EXISTS "Health center and admins can manage medication logs" ON public.medication_logs;

CREATE POLICY "Health center and admins can manage medication logs"
ON public.medication_logs
FOR ALL
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    (
      company_id = public.get_user_company(auth.uid())
      OR company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
    )
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'health_center'::app_role)
    )
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    (
      company_id = public.get_user_company(auth.uid())
      OR company_id = (SELECT company_id FROM public.profiles WHERE id = auth.uid() LIMIT 1)
    )
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'health_center'::app_role)
    )
  )
);
