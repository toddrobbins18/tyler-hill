-- Create division schedule documents table for uploaded schedules per division
CREATE TABLE public.division_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  division_id UUID NOT NULL REFERENCES public.divisions(id) ON DELETE CASCADE,
  schedule_date DATE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  description TEXT,
  uploaded_by UUID REFERENCES auth.users(id),
  season TEXT NOT NULL DEFAULT '2026',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.division_schedules ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view division schedules from their company"
ON public.division_schedules FOR SELECT
USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage division schedules for their company"
ON public.division_schedules FOR ALL
USING (
  company_id = get_user_company(auth.uid()) 
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
)
WITH CHECK (
  company_id = get_user_company(auth.uid()) 
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
);

-- Create index for efficient querying
CREATE INDEX idx_division_schedules_company_date ON public.division_schedules(company_id, schedule_date);
CREATE INDEX idx_division_schedules_division ON public.division_schedules(division_id);

-- Add person_id column to staff table if not exists (for CSV matching)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'staff' AND column_name = 'person_id') THEN
    ALTER TABLE public.staff ADD COLUMN person_id TEXT;
    CREATE INDEX idx_staff_person_id ON public.staff(person_id);
  END IF;
END $$;