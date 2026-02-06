-- Create many-to-many junction table for staff-leader assignments
-- This replaces the single leader_id FK approach, allowing staff to be assigned to multiple leaders
CREATE TABLE public.staff_leader_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  leader_id UUID NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  season TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(staff_id, leader_id, company_id, season)
);

-- Enable RLS
ALTER TABLE public.staff_leader_assignments ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view leader assignments for their company"
ON public.staff_leader_assignments
FOR SELECT
USING (
  company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

CREATE POLICY "Admins can manage leader assignments"
ON public.staff_leader_assignments
FOR ALL
USING (
  company_id IN (
    SELECT p.company_id FROM public.profiles p WHERE p.id = auth.uid()
  )
);

-- Migrate existing leader_id data into the junction table
INSERT INTO public.staff_leader_assignments (staff_id, leader_id, company_id, season)
SELECT s.id, s.leader_id, s.company_id, s.season
FROM public.staff s
WHERE s.leader_id IS NOT NULL
  AND s.company_id IS NOT NULL
  AND s.season IS NOT NULL
ON CONFLICT DO NOTHING;

-- Create indexes for performance
CREATE INDEX idx_staff_leader_assignments_staff ON public.staff_leader_assignments(staff_id);
CREATE INDEX idx_staff_leader_assignments_leader ON public.staff_leader_assignments(leader_id);
CREATE INDEX idx_staff_leader_assignments_company_season ON public.staff_leader_assignments(company_id, season);