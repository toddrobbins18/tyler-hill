-- Timber Lake Camp uses Home/Away/Gordon/etc. as sports_calendar.event_type (see SportsCalendar.tsx).
-- Legacy imports also used "Tournament". Expand the check to match the UI and seeds.

ALTER TABLE public.sports_calendar
DROP CONSTRAINT IF EXISTS sports_calendar_event_type_check;

ALTER TABLE public.sports_calendar
ADD CONSTRAINT sports_calendar_event_type_check
CHECK (
  event_type IS NULL
  OR event_type IN (
    'WC One Day Tournament',
    'WC Knock Out Tournament',
    'Exhibition/Friendly',
    'Invitational',
    'Other',
    'Home',
    'Away',
    'Gordon',
    'Jacobs',
    'Bocian/Melter Bowl',
    'Tournament'
  )
);
