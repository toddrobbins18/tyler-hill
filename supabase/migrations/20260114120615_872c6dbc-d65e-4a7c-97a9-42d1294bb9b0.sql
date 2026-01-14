-- Drop the existing restrictive SELECT policy
DROP POLICY IF EXISTS "Staff can view staff from their company" ON public.staff;

-- Create a more inclusive SELECT policy that includes all admin roles
CREATE POLICY "Users can view staff from their company"
ON public.staff
FOR SELECT
USING (
  company_id = get_user_company(auth.uid())
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'super_admin'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
    OR has_role(auth.uid(), 'division_leader'::app_role)
    OR has_role(auth.uid(), 'specialist'::app_role)
    OR has_role(auth.uid(), 'viewer'::app_role)
  )
);