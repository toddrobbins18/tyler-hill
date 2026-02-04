
-- Drop the existing SELECT policy for staff
DROP POLICY IF EXISTS "Staff can view children from their company" ON public.children;

-- Create a new policy that includes division_leader access
CREATE POLICY "Users can view children from their company" 
ON public.children 
FOR SELECT 
USING (
  (company_id = get_user_company(auth.uid())) 
  AND (
    -- Admins and staff can see all children in their company
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'staff'::app_role)
    OR has_role(auth.uid(), 'health_center'::app_role)
    -- Division leaders and specialists can see children in their assigned divisions
    OR (
      (has_role(auth.uid(), 'division_leader'::app_role) OR has_role(auth.uid(), 'specialist'::app_role) OR has_role(auth.uid(), 'viewer'::app_role))
      AND division_id = ANY(get_user_divisions(auth.uid()))
    )
  )
);
