ALTER TABLE public.daily_wolf_content 
  ADD COLUMN IF NOT EXISTS picture_day TEXT,
  ADD COLUMN IF NOT EXISTS outside_event TEXT,
  ADD COLUMN IF NOT EXISTS staff_days_off TEXT;