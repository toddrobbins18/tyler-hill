-- North Shore Sunshine: keep ONLY Ducklings, Bunnies, Pandas, Giraffes, Koalas (2026)
-- Run in Supabase SQL Editor, then Sunshine Report → Reload from Roster

DO $$
DECLARE
  ns_id uuid := '0d98861f-d956-4bfb-b273-851b3ae56d5c';
  season_year text := '2026';
  allowed text[] := ARRAY['Ducklings', 'Bunnies', 'Pandas', 'Giraffes', 'Koalas'];
BEGIN
  -- Remove campers tied to non-Sunshine groups (Everest, Michigan, etc.)
  DELETE FROM public.sunshine_campers sc
  USING public.sunshine_groups sg
  WHERE sc.group_id = sg.id
    AND sc.company_id = ns_id
    AND sc.season = season_year
    AND sg.company_id = ns_id
    AND sg.season = season_year
    AND NOT (sg.name = ANY (allowed));

  -- Remove extra group tabs
  DELETE FROM public.sunshine_groups sg
  WHERE sg.company_id = ns_id
    AND sg.season = season_year
    AND NOT (sg.name = ANY (allowed));

  -- Ensure all five groups exist (Todd order)
  INSERT INTO public.sunshine_groups (company_id, name, sort_order, season)
  VALUES
    (ns_id, 'Ducklings', 0, season_year),
    (ns_id, 'Bunnies',   1, season_year),
    (ns_id, 'Pandas',    2, season_year),
    (ns_id, 'Giraffes',  3, season_year),
    (ns_id, 'Koalas',    4, season_year)
  ON CONFLICT (company_id, name, season) DO UPDATE
    SET sort_order = EXCLUDED.sort_order;

  -- Replace campers: only children whose FULLSUMMERGROUP is one of the five
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
    AND lower(trim(sg.name)) = lower(trim(c.group_name))
  WHERE c.company_id = ns_id
    AND c.season = season_year
    AND trim(c.group_name) <> ''
    AND lower(trim(c.group_name)) IN (
      'ducklings', 'bunnies', 'pandas', 'giraffes', 'koalas'
    )
    AND COALESCE(lower(c.status), 'active') NOT IN ('inactive', 'withdrawn');
END $$;

SELECT name, sort_order
FROM public.sunshine_groups
WHERE company_id = '0d98861f-d956-4bfb-b273-851b3ae56d5c'
  AND season = '2026'
ORDER BY sort_order;

SELECT sg.name, COUNT(sc.id) AS campers
FROM public.sunshine_groups sg
LEFT JOIN public.sunshine_campers sc ON sc.group_id = sg.id
WHERE sg.company_id = '0d98861f-d956-4bfb-b273-851b3ae56d5c'
  AND sg.season = '2026'
GROUP BY sg.name, sg.sort_order
ORDER BY sg.sort_order;
