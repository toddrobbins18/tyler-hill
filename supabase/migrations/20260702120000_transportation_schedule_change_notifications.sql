-- Transportation schedule-change alerts for sports calendar + field trips.
-- Notifies users tagged "transportation" via notify-transportation-events.

ALTER TABLE public.trips
  ADD COLUMN IF NOT EXISTS field_trip_id uuid REFERENCES public.activities_field_trips(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_trips_field_trip_id
  ON public.trips (field_trip_id)
  WHERE field_trip_id IS NOT NULL;

-- Link existing field-trip transportation rows by prior name/date match.
UPDATE public.trips t
SET field_trip_id = aft.id
FROM public.activities_field_trips aft
WHERE t.field_trip_id IS NULL
  AND t.type = 'field_trip'
  AND t.company_id = aft.company_id
  AND t.season = aft.season
  AND t.name = aft.title
  AND t.date = aft.event_date;

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
      chaperone = NEW.chaperone,
      field_trip_id = NEW.id
    WHERE t.field_trip_id = NEW.id
       OR (
         t.field_trip_id IS NULL
         AND t.company_id = NEW.company_id
         AND t.season = NEW.season
         AND t.type = 'field_trip'
         AND t.name = OLD.title
         AND t.date = OLD.event_date
       );
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_transportation_schedule_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public
AS $$
DECLARE
  supabase_url text;
  service_role_key text;
  payload jsonb;
  source_name text;
BEGIN
  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  source_name := TG_TABLE_NAME;

  IF source_name = 'sports_calendar' THEN
    IF COALESCE(NEW.home_away, '') = 'home' THEN
      RETURN NEW;
    END IF;

    IF NOT (
      OLD.title IS DISTINCT FROM NEW.title
      OR OLD.event_date IS DISTINCT FROM NEW.event_date
      OR OLD.depart_time IS DISTINCT FROM NEW.depart_time
      OR OLD.location IS DISTINCT FROM NEW.location
    ) THEN
      RETURN NEW;
    END IF;

    payload := jsonb_build_object(
      'type', 'UPDATE',
      'source', 'sports_calendar',
      'record', jsonb_build_object(
        'title', NEW.title,
        'event_date', NEW.event_date,
        'depart_time', NEW.depart_time,
        'location', NEW.location,
        'company_id', NEW.company_id
      ),
      'old_record', jsonb_build_object(
        'title', OLD.title,
        'event_date', OLD.event_date,
        'depart_time', OLD.depart_time,
        'location', OLD.location
      )
    );
  ELSIF source_name = 'activities_field_trips' THEN
    IF COALESCE(NEW.home_away, '') = 'home' THEN
      RETURN NEW;
    END IF;

    IF NOT (
      OLD.title IS DISTINCT FROM NEW.title
      OR OLD.event_date IS DISTINCT FROM NEW.event_date
      OR OLD.end_date IS DISTINCT FROM NEW.end_date
      OR OLD.depart_from_camp IS DISTINCT FROM NEW.depart_from_camp
      OR OLD.location IS DISTINCT FROM NEW.location
    ) THEN
      RETURN NEW;
    END IF;

    payload := jsonb_build_object(
      'type', 'UPDATE',
      'source', 'activities_field_trips',
      'record', jsonb_build_object(
        'title', NEW.title,
        'event_date', NEW.event_date,
        'end_date', NEW.end_date,
        'depart_from_camp', NEW.depart_from_camp,
        'location', NEW.location,
        'company_id', NEW.company_id
      ),
      'old_record', jsonb_build_object(
        'title', OLD.title,
        'event_date', OLD.event_date,
        'end_date', OLD.end_date,
        'depart_from_camp', OLD.depart_from_camp,
        'location', OLD.location
      )
    );
  ELSIF source_name = 'trips' THEN
    -- Calendar-linked trip rows are notified from sports_calendar / activities_field_trips.
    IF NEW.sports_event_id IS NOT NULL OR NEW.field_trip_id IS NOT NULL THEN
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

    payload := jsonb_build_object(
      'type', 'UPDATE',
      'source', 'trips',
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
      ),
      'old_record', jsonb_build_object(
        'name', OLD.name,
        'type', OLD.type,
        'date', OLD.date,
        'status', OLD.status,
        'destination', OLD.destination,
        'departure_time', OLD.departure_time,
        'return_time', OLD.return_time,
        'transportation_type', OLD.transportation_type,
        'driver', OLD.driver,
        'chaperone', OLD.chaperone
      )
    );
  ELSE
    RETURN NEW;
  END IF;

  SELECT decrypted_secret INTO supabase_url
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_URL';

  SELECT decrypted_secret INTO service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY';

  IF supabase_url IS NULL OR service_role_key IS NULL THEN
    RAISE WARNING 'notify_transportation_schedule_change skipped: missing vault secrets';
    RETURN NEW;
  END IF;

  PERFORM net.http_post(
    url := rtrim(supabase_url, '/') || '/functions/v1/notify-transportation-events',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || service_role_key
    ),
    body := payload
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING 'notify_transportation_schedule_change failed: %', SQLERRM;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_sports_calendar_transportation_notify ON public.sports_calendar;
CREATE TRIGGER on_sports_calendar_transportation_notify
  AFTER UPDATE ON public.sports_calendar
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_transportation_schedule_change();

DROP TRIGGER IF EXISTS on_field_trip_transportation_notify ON public.activities_field_trips;
CREATE TRIGGER on_field_trip_transportation_notify
  AFTER UPDATE ON public.activities_field_trips
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_transportation_schedule_change();

DROP TRIGGER IF EXISTS on_trip_transportation_notify ON public.trips;
CREATE TRIGGER on_trip_transportation_notify
  AFTER UPDATE ON public.trips
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_transportation_schedule_change();

DROP TRIGGER IF EXISTS sync_linked_trips_on_sports_calendar_update ON public.sports_calendar;
CREATE TRIGGER sync_linked_trips_on_sports_calendar_update
  AFTER UPDATE ON public.sports_calendar
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_linked_trips_from_sports_calendar();

DROP TRIGGER IF EXISTS sync_linked_trips_on_field_trip_update ON public.activities_field_trips;
CREATE TRIGGER sync_linked_trips_on_field_trip_update
  AFTER UPDATE ON public.activities_field_trips
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_linked_trips_from_field_trip();

-- Todd request: transportation staff only, for create + update.
UPDATE public.automated_email_config
SET
  enabled = true,
  recipient_tags = ARRAY['transportation']::text[],
  send_timing = ARRAY['on_create', 'on_update']::text[],
  updated_at = now()
WHERE email_type = 'transportation_events'
  AND company_id IN (
    SELECT id FROM public.companies
    WHERE is_active = true
      AND slug <> 'timber-lake-camp'
  );

INSERT INTO public.automated_email_config (company_id, email_type, enabled, recipient_tags, send_timing)
SELECT
  c.id,
  'transportation_events',
  true,
  ARRAY['transportation']::text[],
  ARRAY['on_create', 'on_update']::text[]
FROM public.companies c
WHERE c.is_active = true
  AND c.slug <> 'timber-lake-camp'
ON CONFLICT (company_id, email_type) DO UPDATE
SET
  enabled = EXCLUDED.enabled,
  recipient_tags = EXCLUDED.recipient_tags,
  send_timing = EXCLUDED.send_timing,
  updated_at = now();
