-- Add sort_order to sports_event_roster to maintain alphabetical order
ALTER TABLE public.sports_event_roster
ADD COLUMN IF NOT EXISTS sort_order INTEGER;
