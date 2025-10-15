-- Drop the triggers with their actual names
DROP TRIGGER IF EXISTS notify_transport_sports ON public.sports_calendar;
DROP TRIGGER IF EXISTS notify_transport_field_trips ON public.activities_field_trips;
DROP TRIGGER IF EXISTS notify_transport_trips ON public.trips;

-- Now drop the function since we're handling trip creation in application code
DROP FUNCTION IF EXISTS public.notify_transportation_on_event();