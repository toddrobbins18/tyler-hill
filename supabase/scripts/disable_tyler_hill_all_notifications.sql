-- Tyler Hill Camp — stop ALL notifications (Daily News email + in-app + event emails).
-- Camp stays visible in the switcher (does NOT set companies.is_active = false).
--
-- Run in Supabase SQL Editor. Safe to re-run.

BEGIN;

CREATE TEMP TABLE _th ON COMMIT DROP AS
SELECT id FROM public.companies WHERE slug = 'tyler-hill-camp' LIMIT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _th) THEN
    RAISE EXCEPTION 'Company tyler-hill-camp not found';
  END IF;
END $$;

UPDATE public.companies c
SET is_active = true,
    updated_at = now()
FROM _th
WHERE c.id = _th.id;

UPDATE public.company_email_config cec
SET is_active = false,
    updated_at = now()
FROM _th
WHERE cec.company_id = _th.id;

UPDATE public.automated_email_config aec
SET enabled = false,
    updated_at = now()
FROM _th
WHERE aec.company_id = _th.id;

UPDATE public.scheduled_notifications sn
SET sent = true,
    sent_at = now(),
    recipient_count = 0,
    error_message = 'Skipped — Tyler Hill camp closed (2026-08-17)'
FROM _th
WHERE sn.company_id = _th.id
  AND sn.sent = false;

COMMIT;

-- Verify
SELECT 'company' AS check, c.slug, c.is_active
FROM public.companies c WHERE c.slug = 'tyler-hill-camp';

SELECT 'company_email_config' AS check, c.slug, cec.is_active
FROM public.company_email_config cec
JOIN public.companies c ON c.id = cec.company_id
WHERE c.slug = 'tyler-hill-camp';

SELECT 'automated_email_config' AS check, aec.email_type, aec.enabled
FROM public.automated_email_config aec
JOIN public.companies c ON c.id = aec.company_id
WHERE c.slug = 'tyler-hill-camp'
ORDER BY aec.email_type;

SELECT 'pending_scheduled_notifications' AS check, COUNT(*) AS remaining
FROM public.scheduled_notifications sn
JOIN public.companies c ON c.id = sn.company_id
WHERE c.slug = 'tyler-hill-camp' AND sn.sent = false;
