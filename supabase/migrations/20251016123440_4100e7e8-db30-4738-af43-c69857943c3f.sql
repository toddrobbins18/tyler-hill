-- Create sports_event_roster table to track which children are attending sports events
CREATE TABLE public.sports_event_roster (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.sports_calendar(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(event_id, child_id)
);

-- Enable RLS
ALTER TABLE public.sports_event_roster ENABLE ROW LEVEL SECURITY;

-- Allow admins and staff to manage sports event rosters
CREATE POLICY "Admins and staff can manage sports event rosters"
ON public.sports_event_roster
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Allow admins and staff to view sports event rosters
CREATE POLICY "Admins and staff can view sports event rosters"
ON public.sports_event_roster
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Add index for better performance
CREATE INDEX idx_sports_event_roster_event_id ON public.sports_event_roster(event_id);
CREATE INDEX idx_sports_event_roster_child_id ON public.sports_event_roster(child_id);