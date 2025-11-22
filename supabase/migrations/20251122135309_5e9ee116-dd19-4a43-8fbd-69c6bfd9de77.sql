-- Phase 1: Add specialty_sports array to staff table
ALTER TABLE staff 
ADD COLUMN IF NOT EXISTS specialty_sports text[] DEFAULT '{}';

COMMENT ON COLUMN staff.specialty_sports IS 'Sports this specialist teaches: Baseball, Basketball, Dance, Football, Golf, Gymnastics, Hockey, Lacrosse, Soccer, Softball, Tennis, Volleyball, Waterfront';

-- Phase 2: Fix constraints on automated_email_config
-- Drop the old single-column unique constraint
ALTER TABLE automated_email_config 
DROP CONSTRAINT IF EXISTS automated_email_config_email_type_key;

-- Add the proper compound unique constraint
ALTER TABLE automated_email_config 
DROP CONSTRAINT IF EXISTS automated_email_config_company_email_type_key;

ALTER TABLE automated_email_config 
ADD CONSTRAINT automated_email_config_company_email_type_key 
UNIQUE (company_id, email_type);

-- Phase 3: Insert email configs based on company features
-- Note: timber-lake-camp doesn't have Activities/Trips or Transportation menus

-- Sports event emails (ALL companies have Sports Calendar)
INSERT INTO automated_email_config (company_id, email_type, enabled, recipient_tags)
SELECT 
  c.id,
  email_type,
  false,
  '{}'::text[]
FROM companies c
CROSS JOIN (
  VALUES 
    ('sports_event_home'),
    ('sports_event_away')
) AS et(email_type)
WHERE c.is_active = true
ON CONFLICT (company_id, email_type) DO NOTHING;

-- Tutoring & Therapy (ALL companies have this menu)
INSERT INTO automated_email_config (company_id, email_type, enabled, recipient_tags)
SELECT 
  c.id,
  'tutoring_therapy',
  false,
  '{}'::text[]
FROM companies c
WHERE c.is_active = true
ON CONFLICT (company_id, email_type) DO NOTHING;

-- Sports Academy (ALL companies have this menu)
INSERT INTO automated_email_config (company_id, email_type, enabled, recipient_tags)
SELECT 
  c.id,
  'sports_academy',
  false,
  '{}'::text[]
FROM companies c
WHERE c.is_active = true
ON CONFLICT (company_id, email_type) DO NOTHING;

-- Trip updates (ONLY for companies with Activities & Field Trips menu - excludes timber-lake-camp)
INSERT INTO automated_email_config (company_id, email_type, enabled, recipient_tags)
SELECT 
  c.id,
  'trip_update',
  false,
  '{}'::text[]
FROM companies c
WHERE c.is_active = true
  AND c.slug != 'timber-lake-camp'
ON CONFLICT (company_id, email_type) DO NOTHING;

-- Transportation events (ONLY for companies with Transportation menu - excludes timber-lake-camp)
INSERT INTO automated_email_config (company_id, email_type, enabled, recipient_tags)
SELECT 
  c.id,
  'transportation_events',
  false,
  '{}'::text[]
FROM companies c
WHERE c.is_active = true
  AND c.slug != 'timber-lake-camp'
ON CONFLICT (company_id, email_type) DO NOTHING;

-- Phase 4: Create database triggers for tutoring and sports academy

-- Tutoring/Therapy trigger
CREATE OR REPLACE FUNCTION notify_tutoring_therapy()
RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-tutoring-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object(
      'enrollment_id', NEW.id,
      'action', TG_OP
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS notify_tutoring_therapy_trigger ON tutoring_therapy;
CREATE TRIGGER notify_tutoring_therapy_trigger
  AFTER INSERT OR UPDATE ON tutoring_therapy
  FOR EACH ROW
  EXECUTE FUNCTION notify_tutoring_therapy();

-- Sports Academy trigger
CREATE OR REPLACE FUNCTION notify_sports_academy()
RETURNS trigger AS $$
BEGIN
  PERFORM net.http_post(
    url := current_setting('app.settings.supabase_url') || '/functions/v1/send-sports-academy-notification',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key')
    ),
    body := jsonb_build_object(
      'enrollment_id', NEW.id,
      'action', TG_OP
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS notify_sports_academy_trigger ON sports_academy;
CREATE TRIGGER notify_sports_academy_trigger
  AFTER INSERT OR UPDATE ON sports_academy
  FOR EACH ROW
  EXECUTE FUNCTION notify_sports_academy();