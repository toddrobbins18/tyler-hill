-- SUPERSEDED: use disable_tyler_hill_all_notifications.sql (Daily News email off too).
--
-- Tyler Hill is closed EXCEPT Daily News emails (birthdays, schedule, etc.).
-- All other automated emails stay off.
--
-- Run in Supabase SQL Editor after disable_tyler_hill_all_emails.sql (or instead of full disable).

BEGIN;

CREATE TEMP TABLE _th ON COMMIT DROP AS
SELECT id FROM public.companies WHERE slug = 'tyler-hill-camp' LIMIT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _th) THEN
    RAISE EXCEPTION 'Company tyler-hill-camp not found';
  END IF;
END $$;

-- Daily News cron (send-daily-dashboard) requires is_active = true
UPDATE public.companies c
SET is_active = true,
    updated_at = now()
FROM _th
WHERE c.id = _th.id;

-- M365 must be on so Daily News reaches inboxes
UPDATE public.company_email_config cec
SET is_active = true,
    updated_at = now()
FROM _th
WHERE cec.company_id = _th.id;

-- Keep all other automated email types disabled (health, meds, incidents, rosters, etc.)
UPDATE public.automated_email_config aec
SET enabled = false,
    updated_at = now()
FROM _th
WHERE aec.company_id = _th.id;

COMMIT;

-- Verify
SELECT 'company' AS check, c.name, c.is_active FROM public.companies c WHERE c.slug = 'tyler-hill-camp';
SELECT 'company_email_config' AS check, cec.is_active FROM public.company_email_config cec
  JOIN public.companies c ON c.id = cec.company_id WHERE c.slug = 'tyler-hill-camp';
SELECT 'automated_email_config' AS check, aec.email_type, aec.enabled FROM public.automated_email_config aec
  JOIN public.companies c ON c.id = aec.company_id WHERE c.slug = 'tyler-hill-camp' ORDER BY 2;
