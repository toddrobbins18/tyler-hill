-- Create health center admissions table
CREATE TABLE public.health_center_admissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  child_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  admitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  admitted_by UUID REFERENCES auth.users(id),
  checked_out_at TIMESTAMP WITH TIME ZONE,
  checked_out_by UUID REFERENCES auth.users(id),
  reason TEXT,
  notes TEXT,
  season TEXT NOT NULL DEFAULT '2026',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.health_center_admissions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins and staff can manage health center admissions"
ON public.health_center_admissions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

CREATE POLICY "Admins and staff can view health center admissions"
ON public.health_center_admissions
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role));

-- Create trigger for updated_at
CREATE TRIGGER update_health_center_admissions_updated_at
BEFORE UPDATE ON public.health_center_admissions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- Create index for faster queries
CREATE INDEX idx_health_center_admissions_child_id ON public.health_center_admissions(child_id);
CREATE INDEX idx_health_center_admissions_checked_out ON public.health_center_admissions(checked_out_at);
CREATE INDEX idx_health_center_admissions_season ON public.health_center_admissions(season);