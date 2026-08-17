-- SUPERSEDED: use disable_timber_lake_all_emails.sql (both TLC + TLW, all emails off).
--
-- Timber Lake Camp — pause ALL notifications except daily bulletin (Tiger Times / birthdays).
-- Effective: 2026-08-15 9:00 AM camp time (run this script at or after that time).
-- Timber Lake West (timber-lake-west) is NOT affected.
--
-- Run in Supabase SQL Editor.

BEGIN;

CREATE TEMP TABLE _tlc ON COMMIT DROP AS
SELECT id FROM public.companies WHERE slug = 'timber-lake-camp' LIMIT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _tlc) THEN
    RAISE EXCEPTION 'Company timber-lake-camp not found';
  END IF;
END $$;

-- Tiger Times / daily bulletin cron requires is_active = true
UPDATE public.companies c
SET is_active = true,
    updated_at = now()
FROM _tlc
WHERE c.id = _tlc.id;

-- M365 must stay on so daily bulletin (birthdays) reaches inboxes
UPDATE public.company_email_config cec
SET is_active = true,
    updated_at = now()
FROM _tlc
WHERE cec.company_id = _tlc.id;

-- Turn off health, meds, incidents, rosters, transport, etc.
UPDATE public.automated_email_config aec
SET enabled = false,
    updated_at = now()
FROM _tlc
WHERE aec.company_id = _tlc.id;

-- Clear queued scheduled emails
UPDATE public.scheduled_notifications sn
SET sent = true,
    sent_at = now(),
    recipient_count = 0,
    error_message = 'Skipped — Timber Lake Camp paused except daily bulletin (2026-08-15)'
FROM _tlc
WHERE sn.company_id = _tlc.id
  AND sn.sent = false;

COMMIT;

-- Verify
SELECT 'company' AS check, c.name, c.slug, c.is_active
FROM public.companies c WHERE c.slug = 'timber-lake-camp';

SELECT 'company_email_config' AS check, cec.is_active, cec.is_configured
FROM public.company_email_config cec
JOIN public.companies c ON c.id = cec.company_id
WHERE c.slug = 'timber-lake-camp';

SELECT 'automated_email_config' AS check, aec.email_type, aec.enabled
FROM public.automated_email_config aec
JOIN public.companies c ON c.id = aec.company_id
WHERE c.slug = 'timber-lake-camp'
ORDER BY aec.email_type;

SELECT 'pending_scheduled_notifications' AS check, COUNT(*) AS remaining
FROM public.scheduled_notifications sn
JOIN public.companies c ON c.id = sn.company_id
WHERE c.slug = 'timber-lake-camp' AND sn.sent = false;
