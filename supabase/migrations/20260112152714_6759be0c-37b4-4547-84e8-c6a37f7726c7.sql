-- Add multi-day support to activities_field_trips table
ALTER TABLE public.activities_field_trips 
ADD COLUMN IF NOT EXISTS end_date DATE,
ADD COLUMN IF NOT EXISTS is_multi_day BOOLEAN DEFAULT false;

-- Update existing activities to ensure is_multi_day is false
UPDATE public.activities_field_trips SET is_multi_day = false WHERE is_multi_day IS NULL;