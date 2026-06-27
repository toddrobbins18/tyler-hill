-- Run in Supabase SQL Editor (immediate fix for multi-camp admin camp switcher)
-- Allows admins with user_roles on multiple companies to see all their camps.

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

-- Verify Dave Welsford
SELECT c.name, ur.role
FROM public.user_roles ur
JOIN public.companies c ON c.id = ur.company_id
JOIN auth.users u ON u.id = ur.user_id
WHERE LOWER(u.email) = 'welsford@camptlc.com'
ORDER BY c.name;
