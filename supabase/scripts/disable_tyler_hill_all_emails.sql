-- Tyler Hill Camp is closed — stop automated emails EXCEPT Daily News (birthdays).
-- Use enable_tyler_hill_daily_news_only.sql to turn Daily News back on.
-- Other camps (Timber Lake, North Shore, etc.) are unchanged.
--
-- Run in Supabase SQL Editor. Safe to re-run.
--
-- What this does:
--   1. Marks Tyler Hill inactive (cron jobs skip inactive companies)
--   2. Disables every automated_email_config row for Tyler Hill
--   3. Disables M365 outbound email for Tyler Hill
--   4. Clears pending scheduled notification emails for Tyler Hill
--
-- To re-enable when camp reopens, see disable_tyler_hill_all_emails_REVERT.sql notes at bottom.

BEGIN;

-- Resolve Tyler Hill company id once
CREATE TEMP TABLE _th ON COMMIT DROP AS
SELECT id, name, slug, is_active AS was_active
FROM public.companies
WHERE slug = 'tyler-hill-camp'
LIMIT 1;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM _th) THEN
    RAISE EXCEPTION 'Company tyler-hill-camp not found';
  END IF;
END $$;

-- 1) Cron edge functions (daily news, health overnight log, tutoring, rosters, missed meds)
--    only loop companies where is_active = true.
UPDATE public.companies c
SET is_active = false,
    updated_at = now()
FROM _th
WHERE c.id = _th.id;

-- 2) Event-driven emails (incidents, health admit/discharge, sports, trips, meds, transport, etc.)
UPDATE public.automated_email_config aec
SET enabled = false,
    updated_at = now()
FROM _th
WHERE aec.company_id = _th.id;

-- 3) Block Microsoft 365 sends for Tyler Hill (belt-and-suspenders)
UPDATE public.company_email_config cec
SET is_active = false,
    updated_at = now()
FROM _th
WHERE cec.company_id = _th.id;

-- 4) Drop queued scheduled emails for Tyler Hill
UPDATE public.scheduled_notifications sn
SET sent = true,
    sent_at = now(),
    recipient_count = 0,
    error_message = 'Skipped — Tyler Hill camp closed (2026-08-13)'
FROM _th
WHERE sn.company_id = _th.id
  AND sn.sent = false;

COMMIT;

-- Verify
SELECT 'company' AS check, c.name, c.slug, c.is_active
FROM public.companies c
WHERE c.slug = 'tyler-hill-camp';

SELECT 'automated_email_config' AS check, aec.email_type, aec.enabled
FROM public.automated_email_config aec
JOIN public.companies c ON c.id = aec.company_id
WHERE c.slug = 'tyler-hill-camp'
ORDER BY aec.email_type;

SELECT 'company_email_config' AS check, cec.is_active, cec.is_configured
FROM public.company_email_config cec
JOIN public.companies c ON c.id = cec.company_id
WHERE c.slug = 'tyler-hill-camp';

SELECT 'pending_scheduled_notifications' AS check, COUNT(*) AS remaining
FROM public.scheduled_notifications sn
JOIN public.companies c ON c.id = sn.company_id
WHERE c.slug = 'tyler-hill-camp'
  AND sn.sent = false;

-- REVERT (when camp reopens — run manually, adjust as needed):
-- UPDATE public.companies SET is_active = true WHERE slug = 'tyler-hill-camp';
-- UPDATE public.automated_email_config aec SET enabled = true
--   FROM public.companies c WHERE c.id = aec.company_id AND c.slug = 'tyler-hill-camp';
-- UPDATE public.company_email_config cec SET is_active = true
--   FROM public.companies c WHERE c.id = cec.company_id AND c.slug = 'tyler-hill-camp';
