-- PHASE 1.2: Create security definer functions for permission checking

-- Check if user is a division leader with access to a specific division
CREATE OR REPLACE FUNCTION public.is_division_leader(_user_id uuid, _division_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.division_permissions dp ON ur.user_id = dp.user_id
    WHERE ur.user_id = _user_id
      AND ur.role = 'division_leader'
      AND dp.division_id = _division_id
      AND dp.can_access = true
  )
$$;

-- Check if user is a specialist
CREATE OR REPLACE FUNCTION public.is_specialist(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'specialist')
$$;

-- Get list of division IDs a user has access to
CREATE OR REPLACE FUNCTION public.get_user_divisions(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(division_id)
  FROM public.division_permissions
  WHERE user_id = _user_id
    AND can_access = true
$$;

-- Check if user can access a specific page based on role permissions
CREATE OR REPLACE FUNCTION public.can_access_page(_user_id uuid, _page_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp ON ur.role = rp.role
    WHERE ur.user_id = _user_id
      AND rp.menu_item = _page_name
      AND rp.can_access = true
  )
$$;