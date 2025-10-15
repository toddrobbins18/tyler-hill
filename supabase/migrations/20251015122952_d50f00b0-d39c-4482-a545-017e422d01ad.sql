-- Create divisions table
CREATE TABLE public.divisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  gender text NOT NULL CHECK (gender IN ('Girls', 'Boys')),
  sort_order integer NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.divisions ENABLE ROW LEVEL SECURITY;

-- Everyone can view divisions
CREATE POLICY "Everyone can view divisions"
ON public.divisions
FOR SELECT
USING (auth.role() = 'authenticated');

-- Only admins can manage divisions
CREATE POLICY "Admins can manage divisions"
ON public.divisions
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Insert the division categories
INSERT INTO public.divisions (name, gender, sort_order) VALUES
  ('Freshman Girls', 'Girls', 1),
  ('Freshman Boys', 'Boys', 2),
  ('Cadet Girls', 'Girls', 3),
  ('Cadet Boys', 'Boys', 4),
  ('Sophomore Girls', 'Girls', 5),
  ('Sophomore Boys', 'Boys', 6),
  ('Junior Girls', 'Girls', 7),
  ('Junior Boys', 'Boys', 8),
  ('Senior Girls', 'Girls', 9),
  ('Senior Boys', 'Boys', 10),
  ('Super Girls', 'Girls', 11),
  ('Super Boys', 'Boys', 12),
  ('Teen Girls', 'Girls', 13),
  ('Teen Boys', 'Boys', 14),
  ('CIT Girls', 'Girls', 15),
  ('CIT Boys', 'Boys', 16);

-- Add division_id to children table
ALTER TABLE public.children 
ADD COLUMN division_id uuid REFERENCES public.divisions(id);

-- Add division_id to master_calendar
ALTER TABLE public.master_calendar
ADD COLUMN division_id uuid REFERENCES public.divisions(id);

-- Add division_id to sports_calendar  
ALTER TABLE public.sports_calendar
ADD COLUMN division_id uuid REFERENCES public.divisions(id);

-- Create division_permissions table for access control
CREATE TABLE public.division_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  division_id uuid REFERENCES public.divisions(id) ON DELETE CASCADE NOT NULL,
  can_access boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, division_id)
);

-- Enable RLS on division_permissions
ALTER TABLE public.division_permissions ENABLE ROW LEVEL SECURITY;

-- Admins can manage division permissions
CREATE POLICY "Admins can manage division permissions"
ON public.division_permissions
FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- Users can view their own division permissions
CREATE POLICY "Users can view own division permissions"
ON public.division_permissions
FOR SELECT
USING (auth.uid() = user_id);