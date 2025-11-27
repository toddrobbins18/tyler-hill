-- Fix children table RLS policies to include company_id filtering
-- This prevents staff from one camp accessing another camp's children

-- Drop insecure policies
DROP POLICY IF EXISTS "Staff can view children from their company" ON children;
DROP POLICY IF EXISTS "Admins and staff can insert children" ON children;
DROP POLICY IF EXISTS "Admins and staff can update children" ON children;
DROP POLICY IF EXISTS "Only admins can delete children" ON children;

-- Create secure SELECT policy with company_id filter
CREATE POLICY "Staff can view children from their company" ON children
FOR SELECT TO authenticated
USING (
  (company_id = get_user_company(auth.uid())) 
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

-- Create secure INSERT policy with company_id check
CREATE POLICY "Admins and staff can insert children" ON children
FOR INSERT TO authenticated
WITH CHECK (
  (company_id = get_user_company(auth.uid()))
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

-- Create secure UPDATE policy with company_id filter
CREATE POLICY "Admins and staff can update children" ON children
FOR UPDATE TO authenticated
USING (
  (company_id = get_user_company(auth.uid()))
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
)
WITH CHECK (
  (company_id = get_user_company(auth.uid()))
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

-- Create secure DELETE policy with company_id filter
CREATE POLICY "Only admins can delete children" ON children
FOR DELETE TO authenticated
USING (
  (company_id = get_user_company(auth.uid()))
  AND is_admin(auth.uid())
);

-- Fix staff table RLS policies to include company_id filtering
-- This prevents staff from one camp accessing another camp's staff

-- Drop insecure policies
DROP POLICY IF EXISTS "Staff can view staff from their company" ON staff;
DROP POLICY IF EXISTS "Admins can insert staff for their company" ON staff;
DROP POLICY IF EXISTS "Admins can update staff for their company" ON staff;
DROP POLICY IF EXISTS "Admins can delete staff for their company" ON staff;

-- Create secure SELECT policy with company_id filter
CREATE POLICY "Staff can view staff from their company" ON staff
FOR SELECT TO authenticated
USING (
  (company_id = get_user_company(auth.uid()))
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

-- Create secure INSERT policy with company_id check
CREATE POLICY "Admins can insert staff for their company" ON staff
FOR INSERT TO authenticated
WITH CHECK (
  (company_id = get_user_company(auth.uid()))
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

-- Create secure UPDATE policy with company_id filter
CREATE POLICY "Admins can update staff for their company" ON staff
FOR UPDATE TO authenticated
USING (
  (company_id = get_user_company(auth.uid()))
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
)
WITH CHECK (
  (company_id = get_user_company(auth.uid()))
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

-- Create secure DELETE policy with company_id filter
CREATE POLICY "Admins can delete staff for their company" ON staff
FOR DELETE TO authenticated
USING (
  (company_id = get_user_company(auth.uid()))
  AND is_admin(auth.uid())
);