-- Add approval status to profiles for user management
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS approval_requested_at TIMESTAMP WITH TIME ZONE;

-- Create master_calendar table
CREATE TABLE IF NOT EXISTS public.master_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  type TEXT NOT NULL,
  time TEXT,
  location TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Create sports_calendar table
CREATE TABLE IF NOT EXISTS public.sports_calendar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sport_type TEXT NOT NULL,
  time TEXT,
  location TEXT,
  team TEXT,
  opponent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Enable RLS on new tables
ALTER TABLE public.master_calendar ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_calendar ENABLE ROW LEVEL SECURITY;

-- RLS policies for master_calendar
CREATE POLICY "Everyone can view master calendar"
ON public.master_calendar
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and staff can manage master calendar"
ON public.master_calendar
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- RLS policies for sports_calendar
CREATE POLICY "Everyone can view sports calendar"
ON public.sports_calendar
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins and staff can manage sports calendar"
ON public.sports_calendar
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Update profiles RLS to allow admins to update approval status
CREATE POLICY "Admins can approve users"
ON public.profiles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role));