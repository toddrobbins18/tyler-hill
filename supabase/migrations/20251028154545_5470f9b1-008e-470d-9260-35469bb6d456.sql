-- Create junction table for multiple children per incident
CREATE TABLE IF NOT EXISTS public.incident_children (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id UUID NOT NULL REFERENCES public.incident_reports(id) ON DELETE CASCADE,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(incident_id, child_id)
);

-- Add tags array and reporter staff reference to incident_reports
ALTER TABLE public.incident_reports
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS reporter_id UUID REFERENCES public.staff(id) ON DELETE SET NULL;

-- Enable RLS on incident_children
ALTER TABLE public.incident_children ENABLE ROW LEVEL SECURITY;

-- RLS policies for incident_children
CREATE POLICY "Admins and staff can manage incident children"
ON public.incident_children
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Migrate existing incidents to junction table
INSERT INTO public.incident_children (incident_id, child_id)
SELECT id, child_id 
FROM public.incident_reports 
WHERE child_id IS NOT NULL
ON CONFLICT (incident_id, child_id) DO NOTHING;