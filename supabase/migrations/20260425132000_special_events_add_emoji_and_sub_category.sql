-- Backfill special events schema parity used by web/mobile forms.
-- Prevents PostgREST 400 errors when payload includes emoji/sub_category.

ALTER TABLE public.special_events_activities
ADD COLUMN IF NOT EXISTS emoji TEXT,
ADD COLUMN IF NOT EXISTS sub_category TEXT;
