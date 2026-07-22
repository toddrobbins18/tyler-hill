-- Align staff counts to CampMinder (hide legacy rows without person_id)
-- Todd targets: TH 344 | TLC 308 | TLW 235
-- Current after bulk reactivate: TH 397 | TLC 327 | TLW 259
--
-- Step 1: Run this SQL (hides rows not linked to CampMinder)
-- Step 2: Deploy updated sync-campminder edge function
-- Step 3: Trigger STAFF sync for each camp from admin / edge function
--         Sync will set active = CampMinder Active list exactly

-- PREVIEW: active staff without CampMinder person_id (legacy CSV/manual rows)
SELECT c.name, COUNT(*) AS active_without_person_id
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE s.season = '2026'
  AND c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
  AND COALESCE(LOWER(s.status), 'active') NOT IN ('inactive')
  AND (s.person_id IS NULL OR TRIM(s.person_id) = '')
GROUP BY c.name
ORDER BY c.name;

-- PREVIEW: sample legacy rows
SELECT c.name, s.name, s.role, s.person_id
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE s.season = '2026'
  AND c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
  AND COALESCE(LOWER(s.status), 'active') NOT IN ('inactive')
  AND (s.person_id IS NULL OR TRIM(s.person_id) = '')
ORDER BY c.name, s.name
LIMIT 50;

BEGIN;

-- Hide legacy staff not linked to CampMinder
UPDATE public.staff s
SET status = 'inactive', updated_at = now()
FROM public.companies c
WHERE s.company_id = c.id
  AND s.season = '2026'
  AND c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
  AND COALESCE(LOWER(s.status), 'active') NOT IN ('inactive')
  AND (s.person_id IS NULL OR TRIM(s.person_id) = '');

COMMIT;

-- Count after hiding legacy rows (before staff sync)
SELECT
  c.name,
  COUNT(*) FILTER (WHERE COALESCE(LOWER(s.status), 'active') NOT IN ('inactive')) AS active_now
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE s.season = '2026'
  AND c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
GROUP BY c.name
ORDER BY c.name;

-- After this: run CampMinder STAFF sync per company to match Todd's counts exactly.
-- Deploy sync-campminder fix first so sync won't mass-inactivate on incomplete API responses.
