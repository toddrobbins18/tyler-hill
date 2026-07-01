-- Run in Supabase SQL Editor if tag assign fails with RLS 42501 (super admin / multi-camp admin).
-- Same as migration 20260701170000_fix_user_tags_rls.sql

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
