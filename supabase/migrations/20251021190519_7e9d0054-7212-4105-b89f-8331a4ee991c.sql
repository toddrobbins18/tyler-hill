-- Add foreign key constraint to tutoring_therapy.child_id
ALTER TABLE public.tutoring_therapy
ADD CONSTRAINT tutoring_therapy_child_id_fkey
FOREIGN KEY (child_id)
REFERENCES public.children(id)
ON DELETE CASCADE;