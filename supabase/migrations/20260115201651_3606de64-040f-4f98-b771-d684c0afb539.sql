-- Add bunk_id column to children table
ALTER TABLE public.children 
ADD COLUMN IF NOT EXISTS bunk_id UUID REFERENCES public.bunks(id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_children_bunk_id ON public.children(bunk_id);

-- Add comment for documentation
COMMENT ON COLUMN public.children.bunk_id IS 'References the bunk this child is assigned to';