-- Create activities_field_trips table
CREATE TABLE public.activities_field_trips (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_date DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  activity_type TEXT NOT NULL,
  time TEXT,
  location TEXT,
  capacity INTEGER,
  chaperone TEXT,
  division_id UUID REFERENCES public.divisions(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.activities_field_trips ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Everyone can view field trips"
ON public.activities_field_trips
FOR SELECT
USING (true);

CREATE POLICY "Admins and staff can manage field trips"
ON public.activities_field_trips
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Create index for better performance
CREATE INDEX idx_field_trips_date ON public.activities_field_trips(event_date);
CREATE INDEX idx_field_trips_division ON public.activities_field_trips(division_id);