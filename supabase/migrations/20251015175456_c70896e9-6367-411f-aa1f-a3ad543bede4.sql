-- Update medication_logs to use meal time text instead of time
-- First, add a new column for meal_time
ALTER TABLE public.medication_logs 
ADD COLUMN meal_time TEXT;

-- Update existing records to have a default meal time
UPDATE public.medication_logs 
SET meal_time = 'Before Breakfast'
WHERE meal_time IS NULL;

-- Make the time column nullable since we'll use meal_time instead
ALTER TABLE public.medication_logs 
ALTER COLUMN scheduled_time DROP NOT NULL;

-- Add a check constraint for valid meal times
ALTER TABLE public.medication_logs 
ADD CONSTRAINT valid_meal_time 
CHECK (meal_time IN (
  'Before Breakfast', 
  'After Breakfast', 
  'Before Lunch', 
  'After Lunch', 
  'Before Dinner', 
  'After Dinner', 
  'Bedtime'
));