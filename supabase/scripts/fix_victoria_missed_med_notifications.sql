-- Fix Victoria (victoria@tylerhillcamp.com) receiving missed med alerts for every camper.
-- Run in Supabase SQL Editor. Safe to re-run.
--
-- Root causes:
--   1) automated_email_config may still include director/admin_staff/nurse (camp-wide tags)
--   2) Victoria has admin role + division_leader tag with too many division_permissions
--
-- After this script, redeploy the check-medication-alerts edge function (code excludes admins).

-- ---------------------------------------------------------------------------
-- 1) Tyler Hill: missed med → division leaders only (not directors/nurses)
-- ---------------------------------------------------------------------------
UPDATE public.automated_email_config aec
SET
  recipient_tags = ARRAY['division_leader']::text[],
  send_timing = ARRAY['on_create']::text[],
  updated_at = now()
FROM public.companies c
WHERE aec.company_id = c.id
  AND c.slug = 'tyler-hill-camp'
  AND aec.email_type = 'missed_medication';

-- ---------------------------------------------------------------------------
-- 2) Victoria: remove division_leader tag (she is camp admin, not a DL)
-- ---------------------------------------------------------------------------
DELETE FROM public.user_tags ut
USING public.profiles p, public.companies c
WHERE ut.user_id = p.id
  AND ut.company_id = c.id
  AND c.slug = 'tyler-hill-camp'
  AND p.email = 'victoria@tylerhillcamp.com'
  AND ut.tag = 'division_leader';

-- ---------------------------------------------------------------------------
-- 3) Victoria: remove excess division_permissions (keeps her from DL-scoped alerts)
-- ---------------------------------------------------------------------------
DELETE FROM public.division_permissions dp
USING public.profiles p, public.companies c
WHERE dp.user_id = p.id
  AND p.company_id = c.id
  AND c.slug = 'tyler-hill-camp'
  AND p.email = 'victoria@tylerhillcamp.com';

-- ---------------------------------------------------------------------------
-- 4) Optional: mark existing missed-med inbox noise as read (uncomment if wanted)
-- ---------------------------------------------------------------------------
-- UPDATE public.messages m
-- SET read = true
-- FROM public.profiles p
-- WHERE m.recipient_id = p.id
--   AND p.email = 'victoria@tylerhillcamp.com'
--   AND m.subject ILIKE 'Missed Medication Alert:%'
--   AND m.read = false;

-- ---------------------------------------------------------------------------
-- Verify
-- ---------------------------------------------------------------------------
SELECT 'missed_medication config' AS check, c.slug, aec.recipient_tags, aec.enabled
FROM public.automated_email_config aec
JOIN public.companies c ON c.id = aec.company_id
WHERE aec.email_type = 'missed_medication'
  AND c.slug = 'tyler-hill-camp';

SELECT 'victoria roles' AS check, ur.role
FROM public.user_roles ur
JOIN public.profiles p ON p.id = ur.user_id
JOIN public.companies c ON c.id = ur.company_id
WHERE c.slug = 'tyler-hill-camp'
  AND p.email = 'victoria@tylerhillcamp.com';

SELECT 'victoria tags' AS check, ut.tag
FROM public.user_tags ut
JOIN public.profiles p ON p.id = ut.user_id
JOIN public.companies c ON c.id = ut.company_id
WHERE c.slug = 'tyler-hill-camp'
  AND p.email = 'victoria@tylerhillcamp.com';

SELECT 'victoria division_permissions' AS check, d.name, d.gender
FROM public.division_permissions dp
JOIN public.profiles p ON p.id = dp.user_id
JOIN public.companies c ON c.id = p.company_id
JOIN public.divisions d ON d.id = dp.division_id
WHERE c.slug = 'tyler-hill-camp'
  AND p.email = 'victoria@tylerhillcamp.com';
