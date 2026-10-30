-- North Shore: guardian_email coverage (run in Supabase SQL Editor)
-- Change season if needed.

WITH params AS (
  SELECT c.id AS company_id, '2026'::text AS season
  FROM public.companies c
  WHERE c.slug = 'north-shore-day-camp'
  LIMIT 1
),
campers AS (
  SELECT ch.name, ch.person_id, ch.guardian_email, ch.status
  FROM public.children ch
  JOIN params p ON p.company_id = ch.company_id AND ch.season = p.season
  WHERE COALESCE(ch.status, 'active') <> 'inactive'
)
SELECT
  (SELECT season FROM params) AS season,
  COUNT(*) AS active_campers,
  COUNT(*) FILTER (WHERE NULLIF(TRIM(guardian_email), '') IS NOT NULL) AS with_guardian_email,
  COUNT(*) FILTER (WHERE NULLIF(TRIM(guardian_email), '') IS NULL) AS missing_guardian_email,
  ROUND(
    100.0 * COUNT(*) FILTER (WHERE NULLIF(TRIM(guardian_email), '') IS NOT NULL) / NULLIF(COUNT(*), 0),
    1
  ) AS pct_with_email
FROM campers;

-- Spot check (Swim ALL KIDS CSV — Jackson / Jacob; includes status)
SELECT ch.name, ch.person_id, ch.status, ch.guardian_email
FROM public.children ch
JOIN public.companies co ON co.id = ch.company_id
WHERE co.slug = 'north-shore-day-camp'
  AND ch.season = '2026'
  AND ch.person_id IN ('20085316', '12487422');
