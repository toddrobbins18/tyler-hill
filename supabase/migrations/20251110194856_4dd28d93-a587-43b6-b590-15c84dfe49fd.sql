-- Create schedule_conflicts table for ALL COMPANIES
CREATE TABLE IF NOT EXISTS public.schedule_conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('child', 'staff')),
  entity_id UUID NOT NULL,
  entity_name TEXT NOT NULL,
  conflict_type TEXT NOT NULL,
  event1_type TEXT NOT NULL,
  event1_id UUID NOT NULL,
  event1_name TEXT NOT NULL,
  event1_date DATE NOT NULL,
  event1_time TEXT,
  event2_type TEXT NOT NULL,
  event2_id UUID NOT NULL,
  event2_name TEXT NOT NULL,
  event2_date DATE NOT NULL,
  event2_time TEXT,
  detected_at TIMESTAMPTZ DEFAULT NOW(),
  resolved BOOLEAN DEFAULT false,
  resolved_by UUID REFERENCES public.profiles(id),
  resolved_at TIMESTAMPTZ,
  override_reason TEXT,
  company_id UUID REFERENCES public.companies(id) NOT NULL,
  season TEXT DEFAULT '2026',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create camper_reports table for Timber Lake Camp
CREATE TABLE IF NOT EXISTS public.camper_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES public.children(id) ON DELETE CASCADE NOT NULL,
  report_type TEXT NOT NULL CHECK (report_type IN ('10_day', 'end_of_summer')),
  report_date DATE NOT NULL,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  company_id UUID REFERENCES public.companies(id) NOT NULL,
  season TEXT DEFAULT '2026',
  report_data JSONB DEFAULT '{}'::jsonb
);

-- Create camper_evaluation_questions table for Timber Lake Camp
CREATE TABLE IF NOT EXISTS public.camper_evaluation_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_type TEXT NOT NULL CHECK (report_type IN ('10_day', 'end_of_summer')),
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('rating', 'text', 'multiple_choice')),
  options JSONB DEFAULT '[]'::jsonb,
  sort_order INTEGER NOT NULL,
  company_id UUID REFERENCES public.companies(id) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.schedule_conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camper_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camper_evaluation_questions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for schedule_conflicts
CREATE POLICY "Users can view conflicts from their company"
  ON public.schedule_conflicts
  FOR SELECT
  USING (
    company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid())
  );

CREATE POLICY "Admins and staff can manage conflicts for their company"
  ON public.schedule_conflicts
  FOR ALL
  USING (
    company_id = get_user_company(auth.uid()) AND 
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  );

-- RLS Policies for camper_reports
CREATE POLICY "Users can view camper reports from their company"
  ON public.camper_reports
  FOR SELECT
  USING (
    company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid())
  );

CREATE POLICY "Admins and staff can manage camper reports for their company"
  ON public.camper_reports
  FOR ALL
  USING (
    company_id = get_user_company(auth.uid()) AND 
    (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
  );

-- RLS Policies for camper_evaluation_questions
CREATE POLICY "Users can view evaluation questions from their company"
  ON public.camper_evaluation_questions
  FOR SELECT
  USING (
    company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid())
  );

CREATE POLICY "Admins can manage evaluation questions for their company"
  ON public.camper_evaluation_questions
  FOR ALL
  USING (
    company_id = get_user_company(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role)
  );

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_schedule_conflicts_entity ON public.schedule_conflicts(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_schedule_conflicts_company ON public.schedule_conflicts(company_id);
CREATE INDEX IF NOT EXISTS idx_schedule_conflicts_resolved ON public.schedule_conflicts(resolved, detected_at DESC);
CREATE INDEX IF NOT EXISTS idx_camper_reports_child ON public.camper_reports(child_id, report_type);
CREATE INDEX IF NOT EXISTS idx_camper_reports_company ON public.camper_reports(company_id, season);
CREATE INDEX IF NOT EXISTS idx_camper_questions_company ON public.camper_evaluation_questions(company_id, report_type, sort_order);

-- Trigger for updating camper_reports updated_at
CREATE TRIGGER update_camper_reports_updated_at
  BEFORE UPDATE ON public.camper_reports
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();