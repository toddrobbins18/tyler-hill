-- Add SELECT policy for staff table so authenticated users can view staff in their company
CREATE POLICY "Users can view staff in their company"
ON public.staff
FOR SELECT
TO authenticated
USING (
  company_id = public.get_user_company(auth.uid())
  OR public.is_super_admin(auth.uid())
);

-- Add INSERT policy for admins
CREATE POLICY "Admins can insert staff in their company"
ON public.staff
FOR INSERT
TO authenticated
WITH CHECK (
  (company_id = public.get_user_company(auth.uid()) AND public.is_admin(auth.uid()))
  OR public.is_super_admin(auth.uid())
);

-- Add UPDATE policy for admins
CREATE POLICY "Admins can update staff in their company"
ON public.staff
FOR UPDATE
TO authenticated
USING (
  (company_id = public.get_user_company(auth.uid()) AND public.is_admin(auth.uid()))
  OR public.is_super_admin(auth.uid())
);

-- Add DELETE policy for admins
CREATE POLICY "Admins can delete staff in their company"
ON public.staff
FOR DELETE
TO authenticated
USING (
  (company_id = public.get_user_company(auth.uid()) AND public.is_admin(auth.uid()))
  OR public.is_super_admin(auth.uid())
);