-- Add guardian_name column to children table for storing parent/guardian name
ALTER TABLE public.children ADD COLUMN IF NOT EXISTS guardian_name text;