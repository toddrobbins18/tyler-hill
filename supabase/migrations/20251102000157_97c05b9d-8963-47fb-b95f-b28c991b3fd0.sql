-- Create security definer function to check if user is super admin
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'super_admin'::app_role)
$$;

-- Create security definer function to get user's company
CREATE OR REPLACE FUNCTION public.get_user_company(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT company_id FROM public.profiles WHERE id = _user_id
$$;

-- RLS policies for companies table
CREATE POLICY "Super admins can do everything on companies"
ON public.companies
FOR ALL
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can view their own company"
ON public.companies
FOR SELECT
USING (id = public.get_user_company(auth.uid()));

CREATE POLICY "Admins can update their own company"
ON public.companies
FOR UPDATE
USING (
  id = public.get_user_company(auth.uid()) 
  AND public.has_role(auth.uid(), 'admin'::app_role)
);

-- Update profiles RLS policies for company boundaries
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

CREATE POLICY "Super admins can view all profiles"
ON public.profiles
FOR SELECT
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Users can view profiles from their company"
ON public.profiles
FOR SELECT
USING (
  company_id = public.get_user_company(auth.uid()) 
  OR auth.uid() = id
);

-- Update children table RLS for company boundaries
DROP POLICY IF EXISTS "Admins and staff can view children" ON public.children;
DROP POLICY IF EXISTS "Leaders can view assigned children" ON public.children;

CREATE POLICY "Super admins can view all children"
ON public.children
FOR SELECT
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Staff can view children from their company"
ON public.children
FOR SELECT
USING (
  (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'staff'::app_role))
);

-- Update staff table RLS for company boundaries
DROP POLICY IF EXISTS "Staff can view own record" ON public.staff;

CREATE POLICY "Super admins can view all staff"
ON public.staff
FOR SELECT
USING (public.is_super_admin(auth.uid()));

CREATE POLICY "Staff can view staff from their company"
ON public.staff
FOR SELECT
USING (
  public.is_admin(auth.uid()) 
  OR (email IN (SELECT email FROM public.profiles WHERE id = auth.uid()))
);