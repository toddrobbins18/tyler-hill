-- Remove the existing CHECK constraint that validates single meal_time values
ALTER TABLE medication_logs DROP CONSTRAINT IF EXISTS valid_meal_time;

-- Change meal_time from text to text[] array to support multiple medication times
ALTER TABLE medication_logs 
ALTER COLUMN meal_time TYPE text[] USING ARRAY[meal_time::text];

-- Add new CHECK constraint to validate array elements are valid meal times
ALTER TABLE medication_logs
ADD CONSTRAINT valid_meal_times CHECK (
  meal_time IS NULL OR 
  (
    array_length(meal_time, 1) > 0 AND
    meal_time <@ ARRAY[
      'Before Breakfast'::text,
      'After Breakfast'::text,
      'Before Lunch'::text,
      'After Lunch'::text,
      'Before Dinner'::text,
      'After Dinner'::text,
      'Bedtime'::text
    ]
  )
);