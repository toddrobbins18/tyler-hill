-- All three closed camps — stop every automated notification (email + in-app via edge functions).
-- Does NOT hide camps from the admin switcher.
--
-- Camps: tyler-hill-camp, timber-lake-camp, timber-lake-west
-- Run in Supabase SQL Editor. Safe to re-run.

BEGIN;

CREATE TEMP TABLE _closed ON COMMIT DROP AS
SELECT id, slug
FROM public.companies
WHERE slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west');

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _closed) THEN
    RAISE EXCEPTION 'No closed camp companies found';
  END IF;
END $$;

UPDATE public.companies c
SET is_active = true,
    updated_at = now()
FROM _closed cl
WHERE c.id = cl.id;

UPDATE public.company_email_config cec
SET is_active = false,
    updated_at = now()
FROM _closed cl
WHERE cec.company_id = cl.id;

UPDATE public.automated_email_config aec
SET enabled = false,
    updated_at = now()
FROM _closed cl
WHERE aec.company_id = cl.id;

UPDATE public.scheduled_notifications sn
SET sent = true,
    sent_at = now(),
    recipient_count = 0,
    error_message = 'Skipped — camp closed (2026-08-17)'
FROM _closed cl
WHERE sn.company_id = cl.id
  AND sn.sent = false;

COMMIT;

SELECT 'company' AS check, c.slug, c.is_active
FROM public.companies c
WHERE c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
ORDER BY c.slug;

SELECT 'company_email_config' AS check, c.slug, cec.is_active
FROM public.company_email_config cec
JOIN public.companies c ON c.id = cec.company_id
WHERE c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
ORDER BY c.slug;
