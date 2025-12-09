-- Add is_active column to divisions table
ALTER TABLE public.divisions ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;