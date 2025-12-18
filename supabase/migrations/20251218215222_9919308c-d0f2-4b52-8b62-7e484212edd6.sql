-- Remove budget_code column from staff table
ALTER TABLE public.staff DROP COLUMN IF EXISTS budget_code;