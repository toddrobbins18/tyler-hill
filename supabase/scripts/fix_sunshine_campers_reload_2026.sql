-- Fix Sunshine Report reload for North Shore 2026
-- 1) Ensure schema for season + child_id + upsert index
-- 2) Populate sunshine_groups + sunshine_campers from children.group_name
--
-- Run in Supabase SQL Editor, then Sunshine Report → Reload from Roster (or refresh page)

-- Schema (safe to re-run)
ALTER TABLE public.sunshine_groups
  ADD COLUMN IF NOT EXISTS season text NOT NULL DEFAULT '2026';

ALTER TABLE public.sunshine_campers
  ADD COLUMN IF NOT EXISTS season text NOT NULL DEFAULT '2026';

ALTER TABLE public.sunshine_campers
  ADD COLUMN IF NOT EXISTS child_id uuid REFERENCES public.children(id) ON DELETE CASCADE;

ALTER TABLE public.sunshine_groups
  DROP CONSTRAINT IF EXISTS sunshine_groups_company_id_name_key;

DROP INDEX IF EXISTS public.sunshine_groups_company_name_season_unique;

CREATE UNIQUE INDEX IF NOT EXISTS sunshine_groups_company_name_season_unique
  ON public.sunshine_groups (company_id, name, season);

DROP INDEX IF EXISTS public.sunshine_campers_company_season_child_unique;

CREATE UNIQUE INDEX IF NOT EXISTS sunshine_campers_company_season_child_unique
  ON public.sunshine_campers (company_id, season, child_id)
  WHERE child_id IS NOT NULL;

-- North Shore Day Camp 2026
DO $$
DECLARE
  ns_id uuid := '0d98861f-d956-4bfb-b273-851b3ae56d5c';
  season_year text := '2026';
BEGIN
  -- Groups from distinct group_name
  INSERT INTO public.sunshine_groups (company_id, name, sort_order, season)
  SELECT
    ns_id,
    g.group_name,
    row_number() OVER (ORDER BY g.group_name) - 1,
    season_year
  FROM (
    SELECT DISTINCT trim(group_name) AS group_name
    FROM public.children
    WHERE company_id = ns_id
      AND season = season_year
      AND trim(group_name) <> ''
      AND COALESCE(lower(status), 'active') NOT IN ('inactive', 'withdrawn')
  ) g
  ON CONFLICT (company_id, name, season) DO NOTHING;

  -- Replace campers for this season
  DELETE FROM public.sunshine_campers
  WHERE company_id = ns_id
    AND season = season_year;

  INSERT INTO public.sunshine_campers (
    company_id,
    group_id,
    child_id,
    full_name,
    parent_email,
    sort_order,
    season
  )
  SELECT
    c.company_id,
    sg.id,
    c.id,
    c.name,
    nullif(trim(c.guardian_email), ''),
    row_number() OVER (PARTITION BY sg.id ORDER BY c.name),
    season_year
  FROM public.children c
  JOIN public.sunshine_groups sg
    ON sg.company_id = c.company_id
    AND sg.season = season_year
    AND sg.name = trim(c.group_name)
  WHERE c.company_id = ns_id
    AND c.season = season_year
    AND trim(c.group_name) <> ''
    AND COALESCE(lower(c.status), 'active') NOT IN ('inactive', 'withdrawn');
END $$;

-- Verify
SELECT
  (SELECT COUNT(*) FROM sunshine_groups
   WHERE company_id = '0d98861f-d956-4bfb-b273-851b3ae56d5c' AND season = '2026') AS groups,
  (SELECT COUNT(*) FROM sunshine_campers
   WHERE company_id = '0d98861f-d956-4bfb-b273-851b3ae56d5c' AND season = '2026') AS campers;

SELECT sg.name, COUNT(sc.id) AS campers
FROM sunshine_groups sg
LEFT JOIN sunshine_campers sc ON sc.group_id = sg.id
WHERE sg.company_id = '0d98861f-d956-4bfb-b273-851b3ae56d5c'
  AND sg.season = '2026'
GROUP BY sg.name
ORDER BY campers DESC, sg.name
LIMIT 10;
