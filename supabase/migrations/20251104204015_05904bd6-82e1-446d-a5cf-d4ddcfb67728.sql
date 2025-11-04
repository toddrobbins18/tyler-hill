-- Fix: Allow all authenticated users to view role permissions
-- Since there's a unique constraint on (role, menu_item), permissions are effectively global
-- despite having a company_id column

DROP POLICY IF EXISTS "Users can view role permissions from their company" ON role_permissions;

CREATE POLICY "Users can view all role permissions"
ON role_permissions
FOR SELECT
TO authenticated
USING (true);

-- Keep admin management policy restricted
DROP POLICY IF EXISTS "Admins can manage role permissions in their company" ON role_permissions;

CREATE POLICY "Admins and super admins can manage role permissions"
ON role_permissions
FOR ALL
TO authenticated
USING (is_admin(auth.uid()) OR is_super_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()) OR is_super_admin(auth.uid()));