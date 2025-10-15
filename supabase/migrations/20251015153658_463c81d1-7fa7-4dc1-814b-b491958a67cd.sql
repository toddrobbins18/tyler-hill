-- Add season column to children table
ALTER TABLE public.children 
ADD COLUMN season VARCHAR(4);

-- Add season column to staff table
ALTER TABLE public.staff 
ADD COLUMN season VARCHAR(4);

-- Create index for better query performance
CREATE INDEX idx_children_season ON public.children(season);
CREATE INDEX idx_staff_season ON public.staff(season);