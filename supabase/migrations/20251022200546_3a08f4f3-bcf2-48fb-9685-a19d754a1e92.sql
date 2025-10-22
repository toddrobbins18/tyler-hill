-- Add date_of_birth column to children table
ALTER TABLE public.children
ADD COLUMN date_of_birth date;

-- Add date_of_birth column to staff table
ALTER TABLE public.staff
ADD COLUMN date_of_birth date;