-- Add sort_order to roster_template_children to maintain alphabetical order
ALTER TABLE public.roster_template_children
ADD COLUMN IF NOT EXISTS sort_order INTEGER;
