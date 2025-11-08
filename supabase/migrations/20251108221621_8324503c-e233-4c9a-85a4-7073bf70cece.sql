-- Drop existing restrictive policy for daily_wolf_content
DROP POLICY IF EXISTS "Admins can manage daily wolf content for their company" ON public.daily_wolf_content;

-- Create new policy that allows super admins to manage content for any company
CREATE POLICY "Admins and super admins can manage daily wolf content"
ON public.daily_wolf_content
FOR ALL
USING (
  -- Super admins can manage any company's content
  is_super_admin(auth.uid())
  OR
  -- Regular admins/staff can only manage their own company's content
  (company_id = get_user_company(auth.uid()) 
   AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)))
)
WITH CHECK (
  -- Same check for INSERT/UPDATE operations
  is_super_admin(auth.uid())
  OR
  (company_id = get_user_company(auth.uid()) 
   AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)))
);