ALTER TABLE public.tutoring_therapy 
ADD COLUMN IF NOT EXISTS weekdays text[] DEFAULT '{}'::text[];