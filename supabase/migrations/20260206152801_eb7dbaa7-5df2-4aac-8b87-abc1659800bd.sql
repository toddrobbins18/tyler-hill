-- Add chaperone/staff column to special_events_activities
ALTER TABLE public.special_events_activities
ADD COLUMN chaperone text;

COMMENT ON COLUMN public.special_events_activities.chaperone IS 'Comma-separated staff names assigned to this event';