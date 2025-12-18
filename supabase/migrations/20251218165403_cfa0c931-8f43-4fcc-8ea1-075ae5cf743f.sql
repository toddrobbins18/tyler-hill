-- Add budget_code and sort_order columns to staff table
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS budget_code text;
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS sort_order integer;