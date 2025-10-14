-- Add gender and category to children table
ALTER TABLE public.children 
ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male', 'female')),
ADD COLUMN IF NOT EXISTS category text,
ADD COLUMN IF NOT EXISTS leader_id uuid REFERENCES public.staff(id);

-- Add leader_id to staff table for hierarchical leadership
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS leader_id uuid REFERENCES public.staff(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_children_leader ON public.children(leader_id);
CREATE INDEX IF NOT EXISTS idx_children_category ON public.children(category);
CREATE INDEX IF NOT EXISTS idx_staff_leader ON public.staff(leader_id);

-- Update RLS policies to allow leaders to view their assigned children/staff
CREATE POLICY "Leaders can view assigned children"
ON public.children
FOR SELECT
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'staff'::app_role)
  OR leader_id IN (
    SELECT id FROM public.staff WHERE email IN (
      SELECT email FROM public.profiles WHERE id = auth.uid()
    )
  )
);

-- Create a table for role permissions
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  menu_item text NOT NULL,
  can_access boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role, menu_item)
);

ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage role permissions"
ON public.role_permissions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Everyone can view role permissions"
ON public.role_permissions
FOR SELECT
USING (auth.role() = 'authenticated');

-- Insert default permissions for existing roles
INSERT INTO public.role_permissions (role, menu_item, can_access) VALUES
  ('admin', 'dashboard', true),
  ('admin', 'roster', true),
  ('admin', 'staff', true),
  ('admin', 'notes', true),
  ('admin', 'awards', true),
  ('admin', 'transportation', true),
  ('admin', 'menu', true),
  ('admin', 'nurse', true),
  ('admin', 'messages', true),
  ('admin', 'admin', true),
  ('staff', 'dashboard', true),
  ('staff', 'roster', true),
  ('staff', 'staff', true),
  ('staff', 'notes', true),
  ('staff', 'awards', true),
  ('staff', 'transportation', true),
  ('staff', 'menu', true),
  ('staff', 'nurse', true),
  ('staff', 'messages', true),
  ('viewer', 'dashboard', true),
  ('viewer', 'roster', true),
  ('viewer', 'messages', true)
ON CONFLICT (role, menu_item) DO NOTHING;