-- Create specialist_sport_assignments table for admin-controlled sport assignments
CREATE TABLE public.specialist_sport_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sport TEXT NOT NULL,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, sport, company_id)
);

-- Enable Row Level Security
ALTER TABLE public.specialist_sport_assignments ENABLE ROW LEVEL SECURITY;

-- Admins can manage sport assignments in their company
CREATE POLICY "Admins can manage sport assignments in their company"
  ON public.specialist_sport_assignments
  FOR ALL
  USING (
    company_id = get_user_company(auth.uid()) 
    AND has_role(auth.uid(), 'admin'::app_role)
  );

-- Users can view sport assignments from their company
CREATE POLICY "Users can view sport assignments from their company"
  ON public.specialist_sport_assignments
  FOR SELECT
  USING (
    company_id = get_user_company(auth.uid()) 
    OR is_super_admin(auth.uid())
  );

-- Super admins can manage all sport assignments
CREATE POLICY "Super admins can manage all sport assignments"
  ON public.specialist_sport_assignments
  FOR ALL
  USING (is_super_admin(auth.uid()));

-- Add updated_at trigger
CREATE TRIGGER handle_specialist_sport_assignments_updated_at
  BEFORE UPDATE ON public.specialist_sport_assignments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add index for performance
CREATE INDEX idx_specialist_sport_assignments_company 
  ON public.specialist_sport_assignments(company_id);

CREATE INDEX idx_specialist_sport_assignments_user_sport 
  ON public.specialist_sport_assignments(user_id, sport);