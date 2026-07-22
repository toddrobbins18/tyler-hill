-- Reactivate Tyler Hill / Timber Lake / Timber Lake West staff marked inactive by sync
-- Todd confirmed CM counts (2026-07-22):
--   Tyler Hill: 344 | Timber Lake Camp: 308 | Timber Lake West: 235
--
-- Nest before fix (active): TH 235 | TLC 232 | TLW 163
-- Run PREVIEW first, then uncomment UPDATE block.

-- Company IDs
-- Tyler Hill:        0d0b7f4f-327e-4497-83ff-3aa501ffc295
-- Timber Lake Camp:  1d296ccf-31e1-4176-af57-50a4a4820f82
-- Timber Lake West:  (resolved from companies.slug below)

-- PREVIEW: current vs Todd expected
SELECT
  c.name,
  COUNT(*) FILTER (WHERE COALESCE(LOWER(s.status), 'active') NOT IN ('inactive')) AS active_now,
  COUNT(*) FILTER (WHERE LOWER(COALESCE(s.status, '')) = 'inactive') AS inactive_now,
  CASE c.slug
    WHEN 'tyler-hill-camp' THEN 344
    WHEN 'timber-lake-camp' THEN 308
    WHEN 'timber-lake-west' THEN 235
  END AS todd_expected,
  CASE c.slug
    WHEN 'tyler-hill-camp' THEN 344
    WHEN 'timber-lake-camp' THEN 308
    WHEN 'timber-lake-west' THEN 235
  END - COUNT(*) FILTER (WHERE COALESCE(LOWER(s.status), 'active') NOT IN ('inactive')) AS gap
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE s.season = '2026'
  AND c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
GROUP BY c.name, c.slug
ORDER BY c.name;

-- PREVIEW: how many rows will be reactivated
SELECT c.name, COUNT(*) AS to_reactivate
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE s.season = '2026'
  AND c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
  AND LOWER(COALESCE(s.status, '')) = 'inactive'
GROUP BY c.name
ORDER BY c.name;

BEGIN;

UPDATE public.staff s
SET status = 'active', updated_at = now()
FROM public.companies c
WHERE s.company_id = c.id
  AND s.season = '2026'
  AND c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
  AND LOWER(COALESCE(s.status, '')) = 'inactive';

COMMIT;

-- VERIFY: should be close to Todd's numbers (may be slightly higher if DB has extra rows)
SELECT
  c.name,
  COUNT(*) FILTER (WHERE COALESCE(LOWER(s.status), 'active') NOT IN ('inactive')) AS active_after,
  COUNT(*) AS total
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE s.season = '2026'
  AND c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
GROUP BY c.name
ORDER BY c.name;

-- NOTE: Next CampMinder staff sync may mark some inactive again if not on CM Active API.
-- Long-term fix: soften sync cleanup logic in sync-campminder edge function.
