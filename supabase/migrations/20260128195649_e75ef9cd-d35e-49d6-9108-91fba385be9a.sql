-- Allow company admins to view unassigned pending profiles so they can approve and assign them
-- (pending users currently have company_id NULL, which made them invisible to admins)

DROP POLICY IF EXISTS "Users view own profile admins view all" ON public.profiles;

CREATE POLICY "Users view own profile admins view all"
ON public.profiles
FOR SELECT
USING (
  (id = auth.uid())
  OR is_super_admin(auth.uid())
  OR (
    has_role(auth.uid(), 'admin'::app_role)
    AND (
      company_id = get_user_company(auth.uid())
      OR (approved = false AND company_id IS NULL)
    )
  )
);