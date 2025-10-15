-- Create function to notify transportation staff about new events
CREATE OR REPLACE FUNCTION public.notify_transportation_on_event()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  event_type TEXT;
  event_data JSONB;
BEGIN
  -- Determine event type based on table
  IF TG_TABLE_NAME = 'sports_calendar' THEN
    event_type := 'Sports Event';
  ELSIF TG_TABLE_NAME = 'activities_field_trips' THEN
    event_type := 'Field Trip';
  ELSIF TG_TABLE_NAME = 'trips' THEN
    event_type := 'Trip';
  ELSE
    event_type := 'Event';
  END IF;

  -- Prepare event data
  event_data := jsonb_build_object(
    'title', COALESCE(NEW.title, NEW.name),
    'event_date', COALESCE(NEW.event_date, NEW.date),
    'location', COALESCE(NEW.location, NEW.destination),
    'type', event_type
  );

  -- Call edge function asynchronously (using pg_net extension if available)
  -- For now, we'll just log and let the frontend handle notifications
  RAISE NOTICE 'New % scheduled: %', event_type, event_data;

  RETURN NEW;
END;
$$;

-- Create triggers for sports events
DROP TRIGGER IF EXISTS notify_transport_sports ON public.sports_calendar;
CREATE TRIGGER notify_transport_sports
AFTER INSERT ON public.sports_calendar
FOR EACH ROW
EXECUTE FUNCTION public.notify_transportation_on_event();

-- Create triggers for field trips
DROP TRIGGER IF EXISTS notify_transport_field_trips ON public.activities_field_trips;
CREATE TRIGGER notify_transport_field_trips
AFTER INSERT ON public.activities_field_trips
FOR EACH ROW
EXECUTE FUNCTION public.notify_transportation_on_event();

-- Create triggers for trips
DROP TRIGGER IF EXISTS notify_transport_trips ON public.trips;
CREATE TRIGGER notify_transport_trips
AFTER INSERT ON public.trips
FOR EACH ROW
EXECUTE FUNCTION public.notify_transportation_on_event();