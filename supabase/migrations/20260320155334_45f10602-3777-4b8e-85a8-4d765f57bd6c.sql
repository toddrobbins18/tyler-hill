
-- Electives table: stores available elective options
CREATE TABLE public.electives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, name)
);

ALTER TABLE public.electives ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view electives from their company"
  ON public.electives FOR SELECT TO authenticated
  USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage electives for their company"
  ON public.electives FOR ALL TO authenticated
  USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)))
  WITH CHECK (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

-- Elective signups table: tracks which camper is assigned to which elective per period/day/week
CREATE TABLE public.elective_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  elective_id uuid NOT NULL REFERENCES public.electives(id) ON DELETE CASCADE,
  week_start_date date NOT NULL,
  day_of_week text NOT NULL,
  period text NOT NULL,
  season text DEFAULT '2026',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id, child_id, week_start_date, day_of_week, period)
);

ALTER TABLE public.elective_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view elective signups from their company"
  ON public.elective_signups FOR SELECT TO authenticated
  USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins and staff can manage elective signups"
  ON public.elective_signups FOR ALL TO authenticated
  USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)))
  WITH CHECK (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));
