-- Drop the existing policy
DROP POLICY IF EXISTS "Admins can manage daily wolf content for their company" ON daily_wolf_content;

-- Recreate the policy with explicit WITH CHECK clause
CREATE POLICY "Admins can manage daily wolf content for their company"
ON daily_wolf_content
FOR ALL
TO public
USING (
  (company_id = get_user_company(auth.uid())) 
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
)
WITH CHECK (
  (company_id = get_user_company(auth.uid())) 
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);