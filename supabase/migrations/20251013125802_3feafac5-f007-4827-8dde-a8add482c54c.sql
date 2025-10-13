-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'staff', 'viewer');

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(user_id, role)
);

-- Enable RLS on user_roles
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Only admins can manage roles
CREATE POLICY "Only admins can insert roles"
ON public.user_roles FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Only admins can update roles"
ON public.user_roles FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Only admins can delete roles"
ON public.user_roles FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Users can view all roles"
ON public.user_roles FOR SELECT
USING (auth.role() = 'authenticated');

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- Create helper function to check if user is admin
CREATE OR REPLACE FUNCTION public.is_admin(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
$$;

-- Remove role column update permission from profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;

CREATE POLICY "Users can update own profile (excluding role)"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id AND role = (SELECT role FROM public.profiles WHERE id = auth.uid()));

-- Update children table RLS policies
DROP POLICY IF EXISTS "Authenticated users can delete children" ON public.children;
DROP POLICY IF EXISTS "Authenticated users can insert children" ON public.children;
DROP POLICY IF EXISTS "Authenticated users can update children" ON public.children;
DROP POLICY IF EXISTS "Authenticated users can view children" ON public.children;

CREATE POLICY "Admins and staff can view children"
ON public.children FOR SELECT
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'staff')
);

CREATE POLICY "Admins and staff can insert children"
ON public.children FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'staff')
);

CREATE POLICY "Admins and staff can update children"
ON public.children FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'staff')
);

CREATE POLICY "Only admins can delete children"
ON public.children FOR DELETE
USING (public.is_admin(auth.uid()));

-- Update staff table RLS policies
DROP POLICY IF EXISTS "Authenticated users can manage staff" ON public.staff;
DROP POLICY IF EXISTS "Authenticated users can view staff" ON public.staff;

CREATE POLICY "Staff can view own record"
ON public.staff FOR SELECT
USING (
  public.is_admin(auth.uid()) OR
  email IN (SELECT email FROM public.profiles WHERE id = auth.uid())
);

CREATE POLICY "Only admins can insert staff"
ON public.staff FOR INSERT
WITH CHECK (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can update staff"
ON public.staff FOR UPDATE
USING (public.is_admin(auth.uid()));

CREATE POLICY "Only admins can delete staff"
ON public.staff FOR DELETE
USING (public.is_admin(auth.uid()));

-- Update staff_evaluations RLS policies
DROP POLICY IF EXISTS "Authenticated users can manage evaluations" ON public.staff_evaluations;
DROP POLICY IF EXISTS "Authenticated users can view evaluations" ON public.staff_evaluations;

CREATE POLICY "Admins can manage evaluations"
ON public.staff_evaluations FOR ALL
USING (public.is_admin(auth.uid()));

CREATE POLICY "Staff can view own evaluations"
ON public.staff_evaluations FOR SELECT
USING (
  public.is_admin(auth.uid()) OR
  staff_id IN (SELECT id FROM public.staff WHERE email IN (SELECT email FROM public.profiles WHERE id = auth.uid()))
);

-- Update awards RLS policies
DROP POLICY IF EXISTS "Authenticated users can manage awards" ON public.awards;
DROP POLICY IF EXISTS "Authenticated users can view awards" ON public.awards;

CREATE POLICY "Admins and staff can manage awards"
ON public.awards FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'staff')
);

-- Update daily_notes RLS policies
DROP POLICY IF EXISTS "Authenticated users can manage daily notes" ON public.daily_notes;
DROP POLICY IF EXISTS "Authenticated users can view daily notes" ON public.daily_notes;

CREATE POLICY "Admins and staff can manage daily notes"
ON public.daily_notes FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'staff')
);

-- Update incident_reports RLS policies
DROP POLICY IF EXISTS "Authenticated users can manage incidents" ON public.incident_reports;
DROP POLICY IF EXISTS "Authenticated users can view incidents" ON public.incident_reports;

CREATE POLICY "Admins and staff can manage incidents"
ON public.incident_reports FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'staff')
);

-- Update events RLS policies
DROP POLICY IF EXISTS "Authenticated users can manage events" ON public.events;
DROP POLICY IF EXISTS "Authenticated users can view events" ON public.events;

CREATE POLICY "Admins and staff can manage events"
ON public.events FOR ALL
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'staff')
);

-- Update menu_items RLS policies
DROP POLICY IF EXISTS "Authenticated users can manage menu" ON public.menu_items;
DROP POLICY IF EXISTS "Authenticated users can view menu" ON public.menu_items;

CREATE POLICY "Everyone can view menu"
ON public.menu_items FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and staff can manage menu"
ON public.menu_items FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'staff')
);

CREATE POLICY "Admins and staff can update menu"
ON public.menu_items FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'staff')
);

CREATE POLICY "Admins and staff can delete menu"
ON public.menu_items FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'staff')
);

-- Update trips RLS policies
DROP POLICY IF EXISTS "Authenticated users can manage trips" ON public.trips;
DROP POLICY IF EXISTS "Authenticated users can view trips" ON public.trips;

CREATE POLICY "Everyone can view trips"
ON public.trips FOR SELECT
USING (auth.role() = 'authenticated');

CREATE POLICY "Admins and staff can manage trips"
ON public.trips FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'staff')
);

CREATE POLICY "Admins and staff can update trips"
ON public.trips FOR UPDATE
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'staff')
);

CREATE POLICY "Admins and staff can delete trips"
ON public.trips FOR DELETE
USING (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'staff')
);

-- Create trigger to assign default viewer role on signup
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer');
  RETURN NEW;
END;
$$;

CREATE TRIGGER assign_role_on_signup
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.assign_default_role();