-- Timber Lake Camp + Timber Lake West — stop ALL automated emails (including Tiger Times / Daily Wolf).
-- Run in Supabase SQL Editor. Safe to re-run.
--
-- Does NOT set companies.is_active = false (that hides camps from the admin switcher).
-- Email stop uses company_email_config + automated_email_config + send-daily-dashboard skip.
--
-- What this does for timber-lake-camp and timber-lake-west:
--   1. Disables every automated_email_config row
--   2. Disables M365 outbound email (blocks daily bulletin + event emails)
--   3. Clears pending scheduled notification emails
--
-- Tyler Hill and other camps are unchanged.

BEGIN;

CREATE TEMP TABLE _tl ON COMMIT DROP AS
SELECT id, slug, name
FROM public.companies
WHERE slug IN ('timber-lake-camp', 'timber-lake-west');

DO $$
DECLARE
  v_count int;
BEGIN
  SELECT COUNT(*) INTO v_count FROM _tl;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'No companies found for timber-lake-camp / timber-lake-west';
  END IF;
  RAISE NOTICE 'Updating % Timber Lake camp(s)', v_count;
END $$;

UPDATE public.automated_email_config aec
SET enabled = false,
    updated_at = now()
FROM _tl
WHERE aec.company_id = _tl.id;

UPDATE public.company_email_config cec
SET is_active = false,
    updated_at = now()
FROM _tl
WHERE cec.company_id = _tl.id;

UPDATE public.scheduled_notifications sn
SET sent = true,
    sent_at = now(),
    recipient_count = 0,
    error_message = 'Skipped — Timber Lake camps closed (2026-08-17)'
FROM _tl
WHERE sn.company_id = _tl.id
  AND sn.sent = false;

COMMIT;

-- Verify
SELECT 'company' AS check, c.name, c.slug, c.is_active
FROM public.companies c
WHERE c.slug IN ('timber-lake-camp', 'timber-lake-west')
ORDER BY c.slug;

SELECT 'company_email_config' AS check, c.slug, cec.is_active, cec.is_configured
FROM public.company_email_config cec
JOIN public.companies c ON c.id = cec.company_id
WHERE c.slug IN ('timber-lake-camp', 'timber-lake-west')
ORDER BY c.slug;

SELECT 'automated_email_config' AS check, c.slug, aec.email_type, aec.enabled
FROM public.automated_email_config aec
JOIN public.companies c ON c.id = aec.company_id
WHERE c.slug IN ('timber-lake-camp', 'timber-lake-west')
ORDER BY c.slug, aec.email_type;

SELECT 'pending_scheduled_notifications' AS check, c.slug, COUNT(*) AS remaining
FROM public.scheduled_notifications sn
JOIN public.companies c ON c.id = sn.company_id
WHERE c.slug IN ('timber-lake-camp', 'timber-lake-west')
  AND sn.sent = false
GROUP BY c.slug
ORDER BY c.slug;

-- REVERT (when camps reopen):
-- UPDATE public.automated_email_config aec SET enabled = true
--   FROM public.companies c WHERE c.id = aec.company_id AND c.slug IN ('timber-lake-camp', 'timber-lake-west');
-- UPDATE public.company_email_config cec SET is_active = true
--   FROM public.companies c WHERE c.id = cec.company_id AND c.slug IN ('timber-lake-camp', 'timber-lake-west');
