-- Add person_id column to children table
ALTER TABLE public.children 
ADD COLUMN person_id TEXT;

-- Add index for person_id for better performance
CREATE INDEX idx_children_person_id ON public.children(person_id);