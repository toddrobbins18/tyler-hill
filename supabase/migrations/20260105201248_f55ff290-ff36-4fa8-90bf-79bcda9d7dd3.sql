-- Fix: Remove public access to master_calendar for unauthenticated users
-- Drop existing policies and recreate with proper authentication requirement

DROP POLICY IF EXISTS "Users can view master calendar for their company" ON public.master_calendar;
DROP POLICY IF EXISTS "Users can insert master calendar for their company" ON public.master_calendar;
DROP POLICY IF EXISTS "Users can update master calendar for their company" ON public.master_calendar;
DROP POLICY IF EXISTS "Users can delete master calendar for their company" ON public.master_calendar;

-- Recreate SELECT policy without the company_id IS NULL bypass
CREATE POLICY "Users can view master calendar for their company"
ON public.master_calendar
FOR SELECT
USING (
  (company_id = get_user_company(auth.uid())) 
  OR is_super_admin(auth.uid())
);

-- Recreate INSERT policy
CREATE POLICY "Users can insert master calendar for their company"
ON public.master_calendar
FOR INSERT
WITH CHECK (
  (company_id = get_user_company(auth.uid())) 
  OR is_super_admin(auth.uid())
);

-- Recreate UPDATE policy
CREATE POLICY "Users can update master calendar for their company"
ON public.master_calendar
FOR UPDATE
USING (
  (company_id = get_user_company(auth.uid())) 
  OR is_super_admin(auth.uid())
);

-- Recreate DELETE policy
CREATE POLICY "Users can delete master calendar for their company"
ON public.master_calendar
FOR DELETE
USING (
  (company_id = get_user_company(auth.uid())) 
  OR is_super_admin(auth.uid())
);