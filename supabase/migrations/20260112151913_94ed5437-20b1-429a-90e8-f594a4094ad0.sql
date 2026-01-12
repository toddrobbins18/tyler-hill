-- Add multi-day trip support columns to trips table
ALTER TABLE public.trips 
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS is_multi_day BOOLEAN DEFAULT false;

-- Update existing trips to ensure is_multi_day is false
UPDATE public.trips SET is_multi_day = false WHERE is_multi_day IS NULL;