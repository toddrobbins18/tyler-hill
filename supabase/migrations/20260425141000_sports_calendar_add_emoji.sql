-- Sports Calendar form parity (web/mobile): support optional emoji icon.

ALTER TABLE public.sports_calendar
ADD COLUMN IF NOT EXISTS emoji TEXT;
