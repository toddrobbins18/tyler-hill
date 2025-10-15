-- Create sports_academy table for tracking camper sports academy enrollment
CREATE TABLE public.sports_academy (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  sport_name TEXT NOT NULL,
  skill_level TEXT,
  instructor TEXT,
  schedule_days TEXT[],
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.sports_academy ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins and staff can view sports academy"
ON public.sports_academy
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admins and staff can manage sports academy"
ON public.sports_academy
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Create indexes
CREATE INDEX idx_sports_academy_child ON public.sports_academy(child_id);
CREATE INDEX idx_sports_academy_sport ON public.sports_academy(sport_name);

-- Add trigger for updated_at
CREATE TRIGGER update_sports_academy_updated_at
BEFORE UPDATE ON public.sports_academy
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();