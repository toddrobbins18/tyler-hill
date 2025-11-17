-- Add allergies field to staff table
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS allergies text;

-- Modify health_center_admissions to support both children and staff
-- Make child_id nullable
ALTER TABLE public.health_center_admissions ALTER COLUMN child_id DROP NOT NULL;

-- Add staff_id column
ALTER TABLE public.health_center_admissions ADD COLUMN IF NOT EXISTS staff_id uuid REFERENCES public.staff(id) ON DELETE CASCADE;

-- Add check constraint to ensure exactly one of child_id or staff_id is set
ALTER TABLE public.health_center_admissions 
ADD CONSTRAINT health_center_admissions_entity_check 
CHECK (
  (child_id IS NOT NULL AND staff_id IS NULL) OR 
  (child_id IS NULL AND staff_id IS NOT NULL)
);

-- Update RLS policies for health_center_admissions to work with both children and staff
-- Drop existing policies
DROP POLICY IF EXISTS "Admins can manage health center admissions for their company" ON public.health_center_admissions;
DROP POLICY IF EXISTS "Users can view health center admissions from their company" ON public.health_center_admissions;

-- Create updated policies that handle both children and staff
CREATE POLICY "Admins can manage health center admissions for their company"
ON public.health_center_admissions
FOR ALL
USING (
  (company_id = get_user_company(auth.uid())) AND 
  (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

CREATE POLICY "Users can view health center admissions from their company"
ON public.health_center_admissions
FOR SELECT
USING (
  (company_id = get_user_company(auth.uid())) OR 
  is_super_admin(auth.uid())
);