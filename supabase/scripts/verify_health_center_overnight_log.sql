-- Run in Supabase SQL Editor to verify the overnight log is fully set up.

-- 1) Email automation rows (should be one per active camp, director tag, enabled)
SELECT
  c.name AS company,
  aec.email_type,
  aec.enabled,
  aec.recipient_tags
FROM public.automated_email_config aec
JOIN public.companies c ON c.id = aec.company_id
WHERE aec.email_type = 'health_center_overnight_log'
ORDER BY c.name;

-- 2) Cron job (should show send-daily-health-center-overnight-log-cron at 0 8 * * *)
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname = 'send-daily-health-center-overnight-log-cron';

-- 3) Trigger function exists
SELECT proname
FROM pg_proc
WHERE proname = 'run_daily_health_center_overnight_log';

-- 4) Who would receive the email (directors with email)
WITH config AS (
  SELECT company_id, unnest(recipient_tags) AS tag
  FROM public.automated_email_config
  WHERE email_type = 'health_center_overnight_log' AND enabled = true
)
SELECT DISTINCT
  c.name AS company,
  p.full_name,
  p.email,
  ut.tag::text AS matched_via
FROM config cfg
JOIN public.companies c ON c.id = cfg.company_id
JOIN public.user_tags ut ON ut.tag::text = cfg.tag AND ut.company_id = cfg.company_id
JOIN public.profiles p ON p.id = ut.user_id
WHERE p.email IS NOT NULL
ORDER BY c.name, p.full_name;

-- 5) Current overnight stays (what tomorrow's 4 AM email would include)
SELECT
  c.name AS company,
  COALESCE(ch.name, st.name, 'Unknown') AS person_name,
  hca.admitted_at,
  hca.reason,
  hca.notes
FROM public.health_center_admissions hca
JOIN public.companies c ON c.id = hca.company_id
LEFT JOIN public.children ch ON ch.id = hca.child_id
LEFT JOIN public.staff st ON st.id = hca.staff_id
WHERE hca.checked_out_at IS NULL
ORDER BY c.name, hca.admitted_at;

-- 6) Manual test: invoke the edge function now (check Edge Functions logs after running)
-- SELECT public.run_daily_health_center_overnight_log();
