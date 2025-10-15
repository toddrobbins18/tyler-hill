-- Create trip_attendees table to track which children are attending trips
CREATE TABLE IF NOT EXISTS public.trip_attendees (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(trip_id, child_id)
);

-- Enable RLS
ALTER TABLE public.trip_attendees ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins and staff can view trip attendees"
ON public.trip_attendees
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admins and staff can manage trip attendees"
ON public.trip_attendees
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Create indexes
CREATE INDEX idx_trip_attendees_trip ON public.trip_attendees(trip_id);
CREATE INDEX idx_trip_attendees_child ON public.trip_attendees(child_id);