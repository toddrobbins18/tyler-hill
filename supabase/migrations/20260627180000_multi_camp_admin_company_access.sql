-- Multi-camp admins (admin role on several companies) can list those camps in the switcher.
-- Super admins already have FOR ALL on companies.

DROP POLICY IF EXISTS "Users can view their own company" ON public.companies;

CREATE POLICY "Users can view their own company"
ON public.companies
FOR SELECT
USING (
  id = public.get_user_company(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
      AND ur.company_id = companies.id
  )
);
