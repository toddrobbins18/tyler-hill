-- Add columns to track who performed manual check in/out
ALTER TABLE public.staff_days_off 
ADD COLUMN IF NOT EXISTS checked_out_by uuid REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS checked_in_by uuid REFERENCES auth.users(id);

-- Add comments for documentation
COMMENT ON COLUMN public.staff_days_off.checked_out_by IS 'User ID of who manually checked the staff out';
COMMENT ON COLUMN public.staff_days_off.checked_in_by IS 'User ID of who manually checked the staff in';