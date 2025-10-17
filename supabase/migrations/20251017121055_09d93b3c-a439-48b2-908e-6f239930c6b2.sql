-- Create junction table for multi-division support on sports calendar
CREATE TABLE IF NOT EXISTS public.sports_calendar_divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sports_event_id UUID NOT NULL REFERENCES public.sports_calendar(id) ON DELETE CASCADE,
  division_id UUID NOT NULL REFERENCES public.divisions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(sports_event_id, division_id)
);

-- Enable RLS on junction table
ALTER TABLE public.sports_calendar_divisions ENABLE ROW LEVEL SECURITY;

-- RLS policies for junction table
CREATE POLICY "Everyone can view sports calendar divisions"
ON public.sports_calendar_divisions
FOR SELECT
USING (true);

CREATE POLICY "Admins and staff can manage sports calendar divisions"
ON public.sports_calendar_divisions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Add custom sport type column to sports_calendar
ALTER TABLE public.sports_calendar
ADD COLUMN IF NOT EXISTS custom_sport_type TEXT;

-- Add event type column to sports_calendar
ALTER TABLE public.sports_calendar
ADD COLUMN IF NOT EXISTS event_type TEXT;

-- Create index for better performance on junction table
CREATE INDEX IF NOT EXISTS idx_sports_calendar_divisions_event ON public.sports_calendar_divisions(sports_event_id);
CREATE INDEX IF NOT EXISTS idx_sports_calendar_divisions_division ON public.sports_calendar_divisions(division_id);

-- Migrate existing single-division events to junction table
INSERT INTO public.sports_calendar_divisions (sports_event_id, division_id)
SELECT id, division_id
FROM public.sports_calendar
WHERE division_id IS NOT NULL
ON CONFLICT (sports_event_id, division_id) DO NOTHING;