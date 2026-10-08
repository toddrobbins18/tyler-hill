-- Verify North Shore day camp transport board in Supabase.
-- Run in: Dashboard → SQL Editor → New query

-- 1) Company
SELECT id, name
FROM public.companies
WHERE id = '0d98861f-d956-4bfb-b273-851b3ae56d5c';

-- 2) Board row exists?
SELECT company_id, season, updated_at, updated_by
FROM public.transport_boards
WHERE company_id = '0d98861f-d956-4bfb-b273-851b3ae56d5c'
ORDER BY season;

-- 3) Summary counts (change season if needed)
WITH board AS (
  SELECT data
  FROM public.transport_boards
  WHERE company_id = '0d98861f-d956-4bfb-b273-851b3ae56d5c'
    AND season = '2027'
),
stops AS (
  SELECT (e.key)::int AS bus_id, stop
  FROM board, jsonb_each(data->'coreStops') e(key, val)
  CROSS JOIN LATERAL jsonb_array_elements(val) stop
)
SELECT
  (SELECT jsonb_array_length(COALESCE(data->'routeMeta', '[]'::jsonb)) FROM board) AS routes_in_meta,
  (SELECT COUNT(DISTINCT bus_id) FROM stops) AS buses_with_stops,
  (SELECT COUNT(*) FROM stops) AS total_stops,
  (SELECT COALESCE(SUM((stop->>'passengers')::int), 0) FROM stops) AS total_campers_on_routes,
  (SELECT jsonb_array_length(COALESCE(data->'unplottedCampers', '[]'::jsonb)) FROM board) AS unplotted_campers,
  (SELECT jsonb_array_length(COALESCE(data->'parentTransportCampers', '[]'::jsonb)) FROM board) AS parent_transport_campers;

-- 3b) Parent transport list (PT tab data — not deleted unless this array is empty)
SELECT
  t.season,
  t.updated_at,
  pt.elem->>'name' AS camper_name,
  pt.elem->>'childId' AS child_id,
  pt.elem->>'routeId' AS route_id,
  pt.elem->>'am' AS am,
  pt.elem->>'pm' AS pm,
  pt.elem->'weekdays' AS weekdays,
  pt.elem->>'notes' AS notes
FROM public.transport_boards t
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(t.data->'parentTransportCampers', '[]'::jsonb)) pt(elem)
WHERE t.company_id = '0d98861f-d956-4bfb-b273-851b3ae56d5c'
ORDER BY t.season, pt.elem->>'name';

-- 4) Per-bus stop counts (MapPoint working → many buses with stops > 0)
SELECT
  (e.key)::int AS bus_id,
  jsonb_array_length(e.val) AS stop_count,
  COALESCE((
    SELECT SUM((s->>'passengers')::int)
    FROM jsonb_array_elements(e.val) s
  ), 0) AS campers
FROM public.transport_boards t
CROSS JOIN LATERAL jsonb_each(t.data->'coreStops') e(key, val)
WHERE t.company_id = '0d98861f-d956-4bfb-b273-851b3ae56d5c'
  AND t.season = '2027'
ORDER BY (e.key)::int;

-- 5) Sample route names (MapPoint loaded → names like "… · Bus N", not generic "Bus N Route")
SELECT elem->>'id' AS id, elem->>'name' AS name, elem->>'bus' AS bus
FROM public.transport_boards t
CROSS JOIN LATERAL jsonb_array_elements(t.data->'routeMeta') elem
WHERE t.company_id = '0d98861f-d956-4bfb-b273-851b3ae56d5c'
  AND t.season = '2027'
ORDER BY (elem->>'id')::int
LIMIT 10;

-- Expected when MapPoint import succeeded:
--   routes_in_meta ~ 41, buses_with_stops ~ 41, total_stops ~ 400, total_campers_on_routes > 0
