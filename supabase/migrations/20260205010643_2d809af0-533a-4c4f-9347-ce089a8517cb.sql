-- Add division_id column to staff table for division assignment
ALTER TABLE public.staff 
ADD COLUMN division_id uuid REFERENCES public.divisions(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_staff_division_id ON public.staff(division_id);

-- Add comment for documentation
COMMENT ON COLUMN public.staff.division_id IS 'The division this staff member is assigned to';