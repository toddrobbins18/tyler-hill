-- Backfill NS 2027 children.home_address from 2026 MapPoint route reference (when CampMinder has no address).
-- Safe: only fills NULL/blank home_address; never overwrites existing values.
--
-- PREREQUISITE: 2026 MapPoint data imported into route_reference_assignments
-- (Transport → Import 2026 MapPoint routes, or staff import flow).
--
-- HOW TO RUN: Supabase SQL Editor → Run entire script → check summary at bottom.

BEGIN;

-- 1) From route reference warehouse (preferred — expanded camper names)
UPDATE public.children c
SET
  home_address = src.address,
  updated_at = now()
FROM (
  SELECT DISTINCT ON (a.camper_name_key)
    a.camper_name_key,
    trim(a.address) AS address
  FROM public.route_reference_assignments a
  JOIN public.companies co ON co.id = a.company_id
  WHERE co.slug = 'north-shore-day-camp'
    AND a.reference_season = '2026'
    AND trim(coalesce(a.address, '')) <> ''
  ORDER BY a.camper_name_key, a.stop_order
) src
JOIN public.companies co ON co.slug = 'north-shore-day-camp'
WHERE c.company_id = co.id
  AND c.season = '2027'
  AND (c.home_address IS NULL OR trim(c.home_address) = '')
  AND lower(trim(regexp_replace(c.name, '\s+', ' ', 'g'))) = src.camper_name_key;

-- 2) Summary
SELECT
  COUNT(*) FILTER (WHERE status = 'active') AS active_campers,
  COUNT(*) FILTER (
    WHERE status = 'active' AND NULLIF(trim(home_address), '') IS NOT NULL
  ) AS with_address,
  COUNT(*) FILTER (
    WHERE status = 'active' AND NULLIF(trim(home_address), '') IS NULL
  ) AS still_missing
FROM public.children c
JOIN public.companies co ON co.id = c.company_id
WHERE co.slug = 'north-shore-day-camp'
  AND c.season = '2027';

-- 3) Sample still missing (first 20)
SELECT person_id, name, grade
FROM public.children c
JOIN public.companies co ON co.id = c.company_id
WHERE co.slug = 'north-shore-day-camp'
  AND c.season = '2027'
  AND (c.home_address IS NULL OR trim(c.home_address) = '')
ORDER BY name
LIMIT 20;

COMMIT;
