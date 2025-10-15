-- Create daily_schedule table for special events and evening activities
CREATE TABLE public.daily_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_date DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  event_type TEXT NOT NULL,
  time_slot TEXT NOT NULL,
  location TEXT,
  division_id UUID REFERENCES public.divisions(id),
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.daily_schedule ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Everyone can view daily schedule"
ON public.daily_schedule
FOR SELECT
USING (true);

CREATE POLICY "Admins and staff can manage daily schedule"
ON public.daily_schedule
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Create indexes
CREATE INDEX idx_daily_schedule_date ON public.daily_schedule(event_date);
CREATE INDEX idx_daily_schedule_division ON public.daily_schedule(division_id);