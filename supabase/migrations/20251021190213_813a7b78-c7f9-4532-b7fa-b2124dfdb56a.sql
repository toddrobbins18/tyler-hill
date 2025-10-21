-- Create tutoring_therapy table
CREATE TABLE public.tutoring_therapy (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id UUID NOT NULL,
  service_type TEXT NOT NULL,
  instructor TEXT,
  schedule_periods TEXT[] DEFAULT '{}'::TEXT[],
  start_date DATE,
  end_date DATE,
  notes TEXT,
  season TEXT DEFAULT '2026'::TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tutoring_therapy ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins and staff can manage tutoring therapy"
ON public.tutoring_therapy
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admins and staff can view tutoring therapy"
ON public.tutoring_therapy
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_tutoring_therapy_updated_at
BEFORE UPDATE ON public.tutoring_therapy
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create indexes for better performance
CREATE INDEX idx_tutoring_therapy_child_id ON public.tutoring_therapy(child_id);
CREATE INDEX idx_tutoring_therapy_service_type ON public.tutoring_therapy(service_type);
CREATE INDEX idx_tutoring_therapy_season ON public.tutoring_therapy(season);