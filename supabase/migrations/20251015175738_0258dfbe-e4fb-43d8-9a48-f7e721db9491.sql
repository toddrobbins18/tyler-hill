-- Update medication_logs to use meal time text
-- Check if column exists and add it if not
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'medication_logs' AND column_name = 'meal_time'
  ) THEN
    ALTER TABLE public.medication_logs ADD COLUMN meal_time TEXT;
  END IF;
END $$;

-- Update existing records to have a default meal time if null
UPDATE public.medication_logs 
SET meal_time = 'Before Breakfast'
WHERE meal_time IS NULL;

-- Make the time column nullable since we'll use meal_time instead
ALTER TABLE public.medication_logs 
ALTER COLUMN scheduled_time DROP NOT NULL;

-- Drop existing constraint if it exists and recreate
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'valid_meal_time'
  ) THEN
    ALTER TABLE public.medication_logs DROP CONSTRAINT valid_meal_time;
  END IF;
END $$;

-- Add check constraint for valid meal times
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