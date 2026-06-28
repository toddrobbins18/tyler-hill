-- Keep transportation trips in sync when sports events / field trips change,
-- and notify transportation contacts when linked trip details change.

CREATE OR REPLACE FUNCTION public.sync_linked_trips_from_sports_calendar()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.trips t
    SET
      name = NEW.title,
      date = NEW.event_date,
      departure_time = NEW.depart_time,
      destination = NEW.location,
      event_type = COALESCE(
        CASE WHEN NEW.sport_type = 'Other' THEN NEW.custom_sport_type ELSE NEW.sport_type END,
        t.event_type
      )
    WHERE t.sports_event_id = NEW.id
      AND (
        t.name IS DISTINCT FROM NEW.title
        OR t.date IS DISTINCT FROM NEW.event_date
        OR t.departure_time IS DISTINCT FROM NEW.depart_time
        OR t.destination IS DISTINCT FROM NEW.location
        OR t.event_type IS DISTINCT FROM COALESCE(
          CASE WHEN NEW.sport_type = 'Other' THEN NEW.custom_sport_type ELSE NEW.sport_type END,
          t.event_type
        )
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_linked_trips_on_sports_calendar_update ON public.sports_calendar;
CREATE TRIGGER sync_linked_trips_on_sports_calendar_update
  AFTER UPDATE ON public.sports_calendar
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_linked_trips_from_sports_calendar();

CREATE OR REPLACE FUNCTION public.sync_linked_trips_from_field_trip()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    UPDATE public.trips t
    SET
      name = NEW.title,
      date = NEW.event_date,
      end_date = CASE WHEN NEW.is_multi_day THEN NEW.end_date ELSE NULL END,
      is_multi_day = COALESCE(NEW.is_multi_day, false),
      departure_time = NEW.depart_from_camp,
      destination = NEW.location,
      event_type = NEW.activity_type,
      capacity = NEW.capacity,
      chaperone = NEW.chaperone
    WHERE t.company_id = NEW.company_id
      AND t.season = NEW.season
      AND t.type = 'field_trip'
      AND t.name = OLD.title
      AND t.date = OLD.event_date
      AND (
        t.name IS DISTINCT FROM NEW.title
        OR t.date IS DISTINCT FROM NEW.event_date
        OR t.end_date IS DISTINCT FROM CASE WHEN NEW.is_multi_day THEN NEW.end_date ELSE NULL END
        OR t.is_multi_day IS DISTINCT FROM COALESCE(NEW.is_multi_day, false)
        OR t.departure_time IS DISTINCT FROM NEW.depart_from_camp
        OR t.destination IS DISTINCT FROM NEW.location
        OR t.event_type IS DISTINCT FROM NEW.activity_type
        OR t.capacity IS DISTINCT FROM NEW.capacity
        OR t.chaperone IS DISTINCT FROM NEW.chaperone
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS sync_linked_trips_on_field_trip_update ON public.activities_field_trips;
CREATE TRIGGER sync_linked_trips_on_field_trip_update
  AFTER UPDATE ON public.activities_field_trips
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_linked_trips_from_field_trip();

CREATE OR REPLACE FUNCTION public.notify_trip_transportation_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  service_role_key text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF NOT (
    OLD.date IS DISTINCT FROM NEW.date
    OR OLD.departure_time IS DISTINCT FROM NEW.departure_time
    OR OLD.return_time IS DISTINCT FROM NEW.return_time
    OR OLD.destination IS DISTINCT FROM NEW.destination
    OR OLD.name IS DISTINCT FROM NEW.name
    OR OLD.status IS DISTINCT FROM NEW.status
    OR OLD.driver IS DISTINCT FROM NEW.driver
    OR OLD.transportation_type IS DISTINCT FROM NEW.transportation_type
  ) THEN
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

  PERFORM net.http_post(
    url := 'https://gdcxtefbarvnrtvacqln.supabase.co/functions/v1/notify-transportation-events',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || COALESCE(service_role_key, '')
    ),
    body := jsonb_build_object(
      'type', 'UPDATE',
      'record', jsonb_build_object(
        'name', NEW.name,
        'type', NEW.type,
        'date', NEW.date,
        'status', NEW.status,
        'destination', NEW.destination,
        'departure_time', NEW.departure_time,
        'return_time', NEW.return_time,
        'transportation_type', NEW.transportation_type,
        'driver', NEW.driver,
        'chaperone', NEW.chaperone,
        'company_id', NEW.company_id
      )
    )
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_trip_transportation_update failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_trip_transportation_notify ON public.trips;
CREATE TRIGGER on_trip_transportation_notify
  AFTER UPDATE ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_trip_transportation_update();

-- Backfill existing linked sports trips that drifted from their calendar event.
UPDATE public.trips t
SET
  name = sc.title,
  date = sc.event_date,
  departure_time = sc.depart_time,
  destination = sc.location,
  event_type = COALESCE(
    CASE WHEN sc.sport_type = 'Other' THEN sc.custom_sport_type ELSE sc.sport_type END,
    t.event_type
  )
FROM public.sports_calendar sc
WHERE t.sports_event_id = sc.id
  AND (
    t.name IS DISTINCT FROM sc.title
    OR t.date IS DISTINCT FROM sc.event_date
    OR t.departure_time IS DISTINCT FROM sc.depart_time
    OR t.destination IS DISTINCT FROM sc.location
  );
