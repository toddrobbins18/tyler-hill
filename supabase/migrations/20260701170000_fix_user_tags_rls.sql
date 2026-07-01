-- user_tags write policy only allowed has_role(..., 'admin'), not super_admin.
-- Super admins switching camp in the app insert rows with that camp's company_id and hit RLS 42501.

DROP POLICY IF EXISTS "Admins can manage user tags" ON public.user_tags;

CREATE POLICY "Admins can manage user tags"
ON public.user_tags
FOR ALL
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.user_has_role_for_company(
    auth.uid(),
    company_id,
    ARRAY['admin']::app_role[]
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.user_has_role_for_company(
    auth.uid(),
    company_id,
    ARRAY['admin']::app_role[]
  )
);
