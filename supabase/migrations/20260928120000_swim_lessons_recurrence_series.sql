-- Group recurring swim lesson instances (same camper, weeks/days batch).

ALTER TABLE public.swim_lessons
  ADD COLUMN IF NOT EXISTS recurrence_series_id UUID;

CREATE INDEX IF NOT EXISTS idx_swim_lessons_recurrence_series
  ON public.swim_lessons (recurrence_series_id)
  WHERE recurrence_series_id IS NOT NULL;

COMMENT ON COLUMN public.swim_lessons.recurrence_series_id IS
  'Shared id for lessons created as one recurring schedule batch';
