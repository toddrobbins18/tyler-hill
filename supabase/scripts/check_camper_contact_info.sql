-- North Shore contact audit — 2027 first (operational season), then 2026.
-- Run in Supabase SQL Editor.

-- 1) North Shore 2027 (primary)
SELECT
  COUNT(*) FILTER (WHERE c.status = 'active') AS active_campers,
  COUNT(*) FILTER (WHERE c.status = 'active' AND NULLIF(trim(c.guardian_email), '') IS NOT NULL) AS with_guardian_email,
  COUNT(*) FILTER (WHERE c.status = 'active' AND NULLIF(trim(c.guardian_name), '') IS NOT NULL) AS with_guardian_name,
  COUNT(*) FILTER (WHERE c.status = 'active' AND NULLIF(trim(c.guardian_phone), '') IS NOT NULL) AS with_guardian_phone,
  COUNT(*) FILTER (
    WHERE c.status = 'active'
      AND NULLIF(trim(c.person_id::text), '') IS NOT NULL
      AND (c.guardian_email IS NULL OR trim(c.guardian_email) = '')
  ) AS active_need_email_backfill
FROM public.children c
JOIN public.companies co ON co.id = c.company_id
WHERE co.slug = 'north-shore-day-camp'
  AND c.season = '2027';

-- 2) North Shore 2026 (same checks)
SELECT
  COUNT(*) FILTER (WHERE c.status = 'active') AS active_campers,
  COUNT(*) FILTER (WHERE c.status = 'active' AND NULLIF(trim(c.guardian_email), '') IS NOT NULL) AS with_guardian_email,
  COUNT(*) FILTER (
    WHERE NULLIF(trim(c.person_id::text), '') IS NOT NULL
      AND (c.guardian_email IS NULL OR trim(c.guardian_email) = '')
  ) AS need_email_backfill
FROM public.children c
JOIN public.companies co ON co.id = c.company_id
WHERE co.slug = 'north-shore-day-camp'
  AND c.season = '2026';

-- 3) FULL LIST — North Shore 2027 campers WITH parent email (after backfill)
SELECT
  c.season,
  c.name AS camper,
  c.group_name,
  c.guardian_name AS parent_name,
  c.guardian_email AS parent_email,
  c.guardian_phone AS parent_phone
FROM public.children c
JOIN public.companies co ON co.id = c.company_id
WHERE co.slug = 'north-shore-day-camp'
  AND c.season = '2027'
  AND c.status = 'active'
  AND NULLIF(trim(c.guardian_email), '') IS NOT NULL
ORDER BY c.name;

-- 3b) FULL LIST — North Shore 2026 campers WITH parent email
SELECT
  c.name AS camper,
  c.group_name,
  c.guardian_name AS parent_name,
  c.guardian_email AS parent_email,
  c.guardian_phone AS parent_phone
FROM public.children c
JOIN public.companies co ON co.id = c.company_id
WHERE co.slug = 'north-shore-day-camp'
  AND c.season = '2026'
  AND c.status = 'active'
  AND NULLIF(trim(c.guardian_email), '') IS NOT NULL
ORDER BY c.name;

-- 4) Sunshine 2027 — parent_email comes FROM children.guardian_email when roster is synced
SELECT
  COUNT(*) AS sunshine_campers,
  COUNT(*) FILTER (WHERE NULLIF(trim(sc.parent_email), '') IS NOT NULL) AS with_parent_email
FROM public.sunshine_campers sc
JOIN public.companies co ON co.id = sc.company_id
WHERE co.slug = 'north-shore-day-camp'
  AND sc.season = '2027';

-- 5) After backfill: refresh sunshine parent emails without re-importing roster
-- UPDATE public.sunshine_campers sc
-- SET parent_email = NULLIF(trim(c.guardian_email), '')
-- FROM public.children c
-- JOIN public.companies co ON co.id = sc.company_id
-- WHERE sc.child_id = c.id
--   AND sc.company_id = c.company_id
--   AND sc.season = '2027'
--   AND c.season = '2027'
--   AND co.slug = 'north-shore-day-camp';
