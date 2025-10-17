-- Update event_type validation to new values
ALTER TABLE public.sports_calendar
DROP CONSTRAINT IF EXISTS sports_calendar_event_type_check;

ALTER TABLE public.sports_calendar
ADD CONSTRAINT sports_calendar_event_type_check 
CHECK (event_type IN ('WC One Day Tournament', 'WC Knock Out Tournament', 'Exhibition/Friendly', 'Invitational', 'Other'));

-- Add division-provided staff flags to sports_calendar
ALTER TABLE public.sports_calendar
ADD COLUMN IF NOT EXISTS division_provides_coach BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS division_provides_ref BOOLEAN DEFAULT false;

-- Add sports_event_id to trips table for linking
ALTER TABLE public.trips
ADD COLUMN IF NOT EXISTS sports_event_id UUID REFERENCES public.sports_calendar(id) ON DELETE SET NULL;

-- Create roster templates table
CREATE TABLE IF NOT EXISTS public.roster_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create junction table for template children
CREATE TABLE IF NOT EXISTS public.roster_template_children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.roster_templates(id) ON DELETE CASCADE,
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(template_id, child_id)
);

-- Create staff assignments table for sports events
CREATE TABLE IF NOT EXISTS public.sports_event_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES public.sports_calendar(id) ON DELETE CASCADE,
  staff_id UUID REFERENCES public.staff(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('coach', 'ref')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, staff_id, role)
);

-- Enable RLS on new tables
ALTER TABLE public.roster_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roster_template_children ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sports_event_staff ENABLE ROW LEVEL SECURITY;

-- RLS Policies for roster_templates
CREATE POLICY "Admins and staff can manage roster templates"
ON public.roster_templates
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Everyone can view roster templates"
ON public.roster_templates
FOR SELECT
USING (true);

-- RLS Policies for roster_template_children
CREATE POLICY "Admins and staff can manage roster template children"
ON public.roster_template_children
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Everyone can view roster template children"
ON public.roster_template_children
FOR SELECT
USING (true);

-- RLS Policies for sports_event_staff
CREATE POLICY "Admins and staff can manage sports event staff"
ON public.sports_event_staff
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Everyone can view sports event staff"
ON public.sports_event_staff
FOR SELECT
USING (true);

-- Create trigger for updating roster_templates.updated_at
CREATE OR REPLACE FUNCTION public.update_roster_template_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_roster_templates_updated_at
BEFORE UPDATE ON public.roster_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_roster_template_updated_at();

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_roster_template_children_template_id ON public.roster_template_children(template_id);
CREATE INDEX IF NOT EXISTS idx_roster_template_children_child_id ON public.roster_template_children(child_id);
CREATE INDEX IF NOT EXISTS idx_sports_event_staff_event_id ON public.sports_event_staff(event_id);
CREATE INDEX IF NOT EXISTS idx_sports_event_staff_staff_id ON public.sports_event_staff(staff_id);
CREATE INDEX IF NOT EXISTS idx_trips_sports_event_id ON public.trips(sports_event_id);