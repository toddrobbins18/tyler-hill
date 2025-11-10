-- Create staff_notes table for timestamped notes on staff profiles
CREATE TABLE IF NOT EXISTS public.staff_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id UUID NOT NULL,
  note TEXT NOT NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  company_id UUID NOT NULL,
  season TEXT DEFAULT '2026',
  CONSTRAINT fk_staff FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.staff_notes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins and staff can manage staff notes for their company"
ON public.staff_notes
FOR ALL
USING (
  is_super_admin(auth.uid())
  OR
  (company_id = get_user_company(auth.uid()) 
   AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)))
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR
  (company_id = get_user_company(auth.uid()) 
   AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)))
);

CREATE POLICY "Users can view staff notes from their company"
ON public.staff_notes
FOR SELECT
USING (
  company_id = get_user_company(auth.uid()) 
  OR is_super_admin(auth.uid())
);

-- Create index for better performance
CREATE INDEX idx_staff_notes_staff_id ON public.staff_notes(staff_id);
CREATE INDEX idx_staff_notes_company_id ON public.staff_notes(company_id);