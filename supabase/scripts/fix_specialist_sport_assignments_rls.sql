-- Run in Supabase SQL Editor (safe to re-run).
-- Specialists couldn't read their own sport assignments when profiles.company_id
-- didn't match get_user_company() — Staff page showed only manual leader assignments.

DROP POLICY IF EXISTS "Users can view their own sport assignments"
  ON public.specialist_sport_assignments;

CREATE POLICY "Users can view their own sport assignments"
ON public.specialist_sport_assignments
FOR SELECT
TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_super_admin(auth.uid())
);

-- Verify Sara (Sarah Pitre) can read her Waterfront assignment
SELECT sport, company_id, user_id
FROM public.specialist_sport_assignments
WHERE user_id = '63565eac-7524-4c82-9f66-3436da89e8c3';
