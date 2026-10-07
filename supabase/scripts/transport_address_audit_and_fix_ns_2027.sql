-- North Shore 2027: compare transport board addresses vs children.home_address (CampMinder),
-- then bulk-fix mismatches on route stops + unplotted campers.
--
-- Run in Supabase SQL Editor in order:
--   1) COMPARE summary
--   2) COMPARE detail (review before fix)
--   3) FIX (updates transport_boards)
--   4) VERIFY
-- After FIX: open Transport portal → Re-geocode (pins refresh from new addresses).

-- ─── Config ─────────────────────────────────────────────────────────────────
-- companies.slug = 'north-shore-day-camp', season = '2027'

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) COMPARE — summary counts
-- ═══════════════════════════════════════════════════════════════════════════
WITH params AS (
  SELECT
    c.id AS company_id,
    '2027'::text AS season
  FROM companies c
  WHERE c.slug = 'north-shore-day-camp'
),
child_roster AS (
  SELECT
    ch.name,
    lower(trim(ch.name)) AS name_key,
    trim(ch.home_address) AS home_address,
    lower(trim(regexp_replace(trim(ch.home_address), '\s+', ' ', 'g'))) AS home_key
  FROM children ch
  JOIN params p ON p.company_id = ch.company_id AND ch.season = p.season
  WHERE ch.status IS DISTINCT FROM 'inactive'
    AND ch.home_address IS NOT NULL
    AND trim(ch.home_address) <> ''
),
board AS (
  SELECT tb.data
  FROM transport_boards tb
  JOIN params p ON p.company_id = tb.company_id AND tb.season = p.season
),
routed_mismatch AS (
  SELECT DISTINCT cr.name
  FROM board b,
  LATERAL jsonb_each(COALESCE(b.data->'coreStops', '{}'::jsonb)) AS route(route_id, stops),
  LATERAL jsonb_array_elements(stops) AS s,
  LATERAL jsonb_array_elements_text(
    CASE
      WHEN jsonb_array_length(COALESCE(s->'camperNames', '[]'::jsonb)) > 0 THEN s->'camperNames'
      ELSE jsonb_build_array(s->>'name')
    END
  ) AS rn(name),
  child_roster cr
  WHERE lower(trim(rn.name)) = cr.name_key
    AND lower(trim(regexp_replace(trim(COALESCE(s->>'address', '')), '\s+', ' ', 'g')))
        IS DISTINCT FROM cr.home_key
),
unplotted_mismatch AS (
  SELECT cr.name
  FROM board b,
  LATERAL jsonb_array_elements(COALESCE(b.data->'unplottedCampers', '[]'::jsonb)) AS u,
  child_roster cr
  WHERE lower(trim(u->>'name')) = cr.name_key
    AND lower(trim(regexp_replace(trim(COALESCE(u->>'address', '')), '\s+', ' ', 'g')))
        IS DISTINCT FROM cr.home_key
),
missing_home AS (
  SELECT ch.name
  FROM children ch
  JOIN params p ON p.company_id = ch.company_id AND ch.season = p.season
  WHERE ch.status IS DISTINCT FROM 'inactive'
    AND (ch.home_address IS NULL OR trim(ch.home_address) = '')
)
SELECT 'routed_wrong_address' AS issue, count(*)::int AS campers FROM routed_mismatch
UNION ALL
SELECT 'unplotted_wrong_address', count(*)::int FROM unplotted_mismatch
UNION ALL
SELECT 'enrolled_missing_home_address', count(*)::int FROM missing_home;


-- ═══════════════════════════════════════════════════════════════════════════
-- 2) COMPARE — detail (old vs correct) — REVIEW THIS BEFORE FIX
-- ═══════════════════════════════════════════════════════════════════════════
WITH params AS (
  SELECT c.id AS company_id, '2027'::text AS season
  FROM companies c WHERE c.slug = 'north-shore-day-camp'
),
child_roster AS (
  SELECT
    ch.name,
    lower(trim(ch.name)) AS name_key,
    trim(ch.home_address) AS home_address,
    lower(trim(regexp_replace(trim(ch.home_address), '\s+', ' ', 'g'))) AS home_key
  FROM children ch
  JOIN params p ON p.company_id = ch.company_id AND ch.season = p.season
  WHERE ch.status IS DISTINCT FROM 'inactive'
    AND ch.home_address IS NOT NULL AND trim(ch.home_address) <> ''
)
SELECT * FROM (
  SELECT
    'on_route' AS location,
    route.route_id,
    rn.name AS camper_name,
    trim(s->>'address') AS board_address,
    cr.home_address AS correct_address,
    (s->>'lat')::float AS lat,
    (s->>'lng')::float AS lng
  FROM transport_boards tb
  JOIN params p ON p.company_id = tb.company_id AND tb.season = p.season,
  LATERAL jsonb_each(COALESCE(tb.data->'coreStops', '{}'::jsonb)) AS route(route_id, stops),
  LATERAL jsonb_array_elements(stops) AS s,
  LATERAL jsonb_array_elements_text(
    CASE
      WHEN jsonb_array_length(COALESCE(s->'camperNames', '[]'::jsonb)) > 0 THEN s->'camperNames'
      ELSE jsonb_build_array(s->>'name')
    END
  ) AS rn(name),
  child_roster cr
  WHERE lower(trim(rn.name)) = cr.name_key
    AND lower(trim(regexp_replace(trim(COALESCE(s->>'address', '')), '\s+', ' ', 'g')))
        IS DISTINCT FROM cr.home_key

  UNION ALL

  SELECT
    'unplotted',
    NULL::text,
    u->>'name',
    trim(u->>'address'),
    cr.home_address,
    (u->>'lat')::float,
    (u->>'lng')::float
  FROM transport_boards tb
  JOIN params p ON p.company_id = tb.company_id AND tb.season = p.season,
  LATERAL jsonb_array_elements(COALESCE(tb.data->'unplottedCampers', '[]'::jsonb)) AS u,
  child_roster cr
  WHERE lower(trim(u->>'name')) = cr.name_key
    AND lower(trim(regexp_replace(trim(COALESCE(u->>'address', '')), '\s+', ' ', 'g')))
        IS DISTINCT FROM cr.home_key
) mismatches
ORDER BY camper_name, location;


-- ═══════════════════════════════════════════════════════════════════════════
-- 3) FIX — bulk update route stops + unplotted from children.home_address
--    Resets lat/lng to 0 so Transport → Re-geocode picks new pins.
-- ═══════════════════════════════════════════════════════════════════════════
WITH params AS (
  SELECT c.id AS company_id, '2027'::text AS season
  FROM companies c WHERE c.slug = 'north-shore-day-camp'
),
child_roster AS (
  SELECT
    lower(trim(ch.name)) AS name_key,
    trim(ch.home_address) AS home_address,
    lower(trim(regexp_replace(trim(ch.home_address), '\s+', ' ', 'g'))) AS home_key
  FROM children ch
  JOIN params p ON p.company_id = ch.company_id AND ch.season = p.season
  WHERE ch.status IS DISTINCT FROM 'inactive'
    AND ch.home_address IS NOT NULL AND trim(ch.home_address) <> ''
),
target AS (
  SELECT tb.company_id, tb.season, tb.data
  FROM transport_boards tb
  JOIN params p ON p.company_id = tb.company_id AND tb.season = p.season
),
new_core AS (
  SELECT
    t.company_id,
    t.season,
    COALESCE(
      jsonb_object_agg(
        r.route_id,
        (
          SELECT COALESCE(
            jsonb_agg(
              CASE
                WHEN fix.new_address IS NOT NULL THEN
                  elem || jsonb_build_object(
                    'address', fix.new_address,
                    'lat', 0,
                    'lng', 0
                  )
                ELSE elem
              END
            ),
            '[]'::jsonb
          )
          FROM jsonb_array_elements(r.stops) AS elem
          LEFT JOIN LATERAL (
            SELECT cr.home_address AS new_address
            FROM child_roster cr
            WHERE (
              cr.name_key = lower(trim(elem->>'name'))
              OR EXISTS (
                SELECT 1
                FROM jsonb_array_elements_text(COALESCE(elem->'camperNames', '[]'::jsonb)) AS rn(name)
                WHERE lower(trim(rn.name)) = cr.name_key
              )
            )
            AND lower(trim(regexp_replace(trim(COALESCE(elem->>'address', '')), '\s+', ' ', 'g')))
                IS DISTINCT FROM cr.home_key
            ORDER BY CASE WHEN cr.name_key = lower(trim(elem->>'name')) THEN 0 ELSE 1 END
            LIMIT 1
          ) fix ON true
        )
      ),
      COALESCE(t.data->'coreStops', '{}'::jsonb)
    ) AS core_stops
  FROM target t
  CROSS JOIN LATERAL jsonb_each(COALESCE(t.data->'coreStops', '{}'::jsonb)) AS r(route_id, stops)
  GROUP BY t.company_id, t.season, t.data
),
new_unplotted AS (
  SELECT
    t.company_id,
    t.season,
    COALESCE(
      (
        SELECT jsonb_agg(
          CASE
            WHEN cr.home_address IS NOT NULL
              AND lower(trim(regexp_replace(trim(COALESCE(u->>'address', '')), '\s+', ' ', 'g')))
                  IS DISTINCT FROM cr.home_key
            THEN u || jsonb_build_object(
              'address', cr.home_address,
              'lat', 0,
              'lng', 0
            )
            ELSE u
          END
        )
        FROM jsonb_array_elements(COALESCE(t.data->'unplottedCampers', '[]'::jsonb)) AS u
        LEFT JOIN child_roster cr ON cr.name_key = lower(trim(u->>'name'))
      ),
      COALESCE(t.data->'unplottedCampers', '[]'::jsonb)
    ) AS unplotted
  FROM target t
)
UPDATE transport_boards tb
SET
  data = jsonb_set(
    jsonb_set(tb.data, '{coreStops}', nc.core_stops, true),
    '{unplottedCampers}',
    nu.unplotted,
    true
  ),
  updated_at = now()
FROM new_core nc
JOIN new_unplotted nu
  ON nu.company_id = nc.company_id AND nu.season = nc.season
WHERE tb.company_id = nc.company_id
  AND tb.season = nc.season;


-- ═══════════════════════════════════════════════════════════════════════════
-- 4) VERIFY — should return 0 rows if all fixed
-- ═══════════════════════════════════════════════════════════════════════════
WITH params AS (
  SELECT c.id AS company_id, '2027'::text AS season
  FROM companies c WHERE c.slug = 'north-shore-day-camp'
),
child_roster AS (
  SELECT
    ch.name,
    lower(trim(ch.name)) AS name_key,
    trim(ch.home_address) AS home_address,
    lower(trim(regexp_replace(trim(ch.home_address), '\s+', ' ', 'g'))) AS home_key
  FROM children ch
  JOIN params p ON p.company_id = ch.company_id AND ch.season = p.season
  WHERE ch.status IS DISTINCT FROM 'inactive'
    AND ch.home_address IS NOT NULL AND trim(ch.home_address) <> ''
)
SELECT route.route_id, rn.name AS camper_name,
       trim(s->>'address') AS still_wrong_address,
       cr.home_address AS should_be
FROM transport_boards tb
JOIN params p ON p.company_id = tb.company_id AND tb.season = p.season,
LATERAL jsonb_each(COALESCE(tb.data->'coreStops', '{}'::jsonb)) AS route(route_id, stops),
LATERAL jsonb_array_elements(stops) AS s,
LATERAL jsonb_array_elements_text(
  CASE
    WHEN jsonb_array_length(COALESCE(s->'camperNames', '[]'::jsonb)) > 0 THEN s->'camperNames'
    ELSE jsonb_build_array(s->>'name')
  END
) AS rn(name),
child_roster cr
WHERE lower(trim(rn.name)) = cr.name_key
  AND lower(trim(regexp_replace(trim(COALESCE(s->>'address', '')), '\s+', ' ', 'g')))
      IS DISTINCT FROM cr.home_key
ORDER BY camper_name;


-- ═══════════════════════════════════════════════════════════════════════════
-- 5) MONITOR — progress while "Fix Addresses from CampMinder" is running
--    (No DB job table — geocoding runs via route-optimizer edge function.
--     Re-run these queries every 30s; watch need_geocode go down.)
-- ═══════════════════════════════════════════════════════════════════════════
WITH params AS (
  SELECT c.id AS company_id, '2027'::text AS season
  FROM companies c WHERE c.slug = 'north-shore-day-camp'
),
board AS (
  SELECT tb.updated_at, tb.data
  FROM transport_boards tb
  JOIN params p ON p.company_id = tb.company_id AND tb.season = p.season
),
route_stops AS (
  SELECT
    route.route_id,
    s->>'name' AS stop_name,
    trim(s->>'address') AS address,
    NULLIF(s->>'lat', '')::double precision AS lat,
    NULLIF(s->>'lng', '')::double precision AS lng
  FROM board b,
  LATERAL jsonb_each(COALESCE(b.data->'coreStops', '{}'::jsonb)) AS route(route_id, stops),
  LATERAL jsonb_array_elements(stops) AS s
),
unplotted AS (
  SELECT
    u->>'name' AS camper_name,
    trim(u->>'address') AS address,
    NULLIF(u->>'lat', '')::double precision AS lat,
    NULLIF(u->>'lng', '')::double precision AS lng
  FROM board b,
  LATERAL jsonb_array_elements(COALESCE(b.data->'unplottedCampers', '[]'::jsonb)) AS u
)
SELECT
  (SELECT updated_at FROM board) AS board_last_saved,
  (SELECT count(*) FROM route_stops WHERE address IS NOT NULL AND address <> '') AS route_stops_total,
  (SELECT count(*) FROM route_stops
   WHERE address IS NOT NULL AND address <> ''
     AND (lat IS NULL OR lng IS NULL OR (lat = 0 AND lng = 0))) AS route_stops_need_geocode,
  (SELECT count(*) FROM unplotted WHERE address IS NOT NULL AND address <> '') AS unplotted_total,
  (SELECT count(*) FROM unplotted
   WHERE address IS NOT NULL AND address <> ''
     AND (lat IS NULL OR lng IS NULL OR (lat = 0 AND lng = 0))) AS unplotted_need_geocode;


-- 5b) Address text fix progress (should trend to 0 after fix, before/during geocode)
WITH params AS (
  SELECT c.id AS company_id, '2027'::text AS season
  FROM companies c WHERE c.slug = 'north-shore-day-camp'
),
child_roster AS (
  SELECT
    lower(trim(ch.name)) AS name_key,
    lower(trim(regexp_replace(trim(ch.home_address), '\s+', ' ', 'g'))) AS home_key
  FROM children ch
  JOIN params p ON p.company_id = ch.company_id AND ch.season = p.season
  WHERE ch.status IS DISTINCT FROM 'inactive'
    AND ch.home_address IS NOT NULL AND trim(ch.home_address) <> ''
),
board AS (
  SELECT tb.data FROM transport_boards tb
  JOIN params p ON p.company_id = tb.company_id AND tb.season = p.season
)
SELECT
  count(DISTINCT cr.name_key) FILTER (
    WHERE lower(trim(regexp_replace(trim(COALESCE(s->>'address', '')), '\s+', ' ', 'g')))
      IS DISTINCT FROM cr.home_key
  ) AS campers_still_wrong_address,
  count(DISTINCT cr.name_key) AS campers_on_routes_checked
FROM board b,
LATERAL jsonb_each(COALESCE(b.data->'coreStops', '{}'::jsonb)) AS route(route_id, stops),
LATERAL jsonb_array_elements(stops) AS s,
LATERAL jsonb_array_elements_text(
  CASE
    WHEN jsonb_array_length(COALESCE(s->'camperNames', '[]'::jsonb)) > 0 THEN s->'camperNames'
    ELSE jsonb_build_array(s->>'name')
  END
) AS rn(name),
child_roster cr
WHERE lower(trim(rn.name)) = cr.name_key;


-- 5c) Which stops still need geocode (pins at 0,0) — names + addresses
WITH params AS (
  SELECT c.id AS company_id, '2027'::text AS season
  FROM companies c WHERE c.slug = 'north-shore-day-camp'
)
SELECT
  route.route_id AS bus,
  s->>'name' AS stop_or_camper,
  trim(s->>'address') AS address,
  s->>'lat' AS lat,
  s->>'lng' AS lng
FROM transport_boards tb
JOIN params p ON p.company_id = tb.company_id AND tb.season = p.season,
LATERAL jsonb_each(COALESCE(tb.data->'coreStops', '{}'::jsonb)) AS route(route_id, stops),
LATERAL jsonb_array_elements(stops) AS s
WHERE trim(COALESCE(s->>'address', '')) <> ''
  AND (
    NULLIF(s->>'lat', '') IS NULL
    OR NULLIF(s->>'lng', '') IS NULL
    OR ((s->>'lat')::double precision = 0 AND (s->>'lng')::double precision = 0)
  )
ORDER BY bus, stop_or_camper;


-- ═══════════════════════════════════════════════════════════════════════════
-- 6) SPOT CHECK — Isabella (Izzy) Corn/Korn @ 33 Wood (Locust Valley)
--    CampMinder person 16508258 is "Isabella Corn" (not Korn). Todd may say "Izzy Korn".
-- ═══════════════════════════════════════════════════════════════════════════

-- 6a) CampMinder row in children (source of truth)
WITH params AS (
  SELECT c.id AS company_id, '2027'::text AS season
  FROM companies c WHERE c.slug = 'north-shore-day-camp'
)
SELECT
  ch.campminder_id,
  ch.name,
  trim(ch.home_address) AS home_address,
  ch.status,
  ch.grade,
  ch.group_name
FROM children ch
JOIN params p ON p.company_id = ch.company_id AND ch.season = p.season
WHERE ch.status IS DISTINCT FROM 'inactive'
  AND (
    lower(trim(ch.name)) LIKE '%corn%'
    OR lower(trim(ch.name)) LIKE '%korn%'
    OR lower(trim(ch.home_address)) LIKE '%wood%'
  )
  AND (
    lower(trim(ch.name)) LIKE '%isabella%'
    OR lower(trim(ch.name)) LIKE '%izzy%'
    OR lower(trim(ch.home_address)) LIKE '%33%wood%'
  )
ORDER BY ch.name;


-- 6b) Where she appears on the transport board (routed)
WITH params AS (
  SELECT c.id AS company_id, '2027'::text AS season
  FROM companies c WHERE c.slug = 'north-shore-day-camp'
),
needles AS (
  SELECT unnest(ARRAY[
    'isabella corn', 'izzy corn', 'isabella korn', 'izzy korn'
  ]) AS name_key
)
SELECT
  route.route_id AS bus,
  rn.name AS camper_on_stop,
  trim(s->>'address') AS stop_address,
  s->>'lat' AS lat,
  s->>'lng' AS lng,
  s->>'name' AS stop_label,
  s->'camperNames' AS camper_names_json
FROM transport_boards tb
JOIN params p ON p.company_id = tb.company_id AND tb.season = p.season,
LATERAL jsonb_each(COALESCE(tb.data->'coreStops', '{}'::jsonb)) AS route(route_id, stops),
LATERAL jsonb_array_elements(stops) AS s,
LATERAL jsonb_array_elements_text(
  CASE
    WHEN jsonb_array_length(COALESCE(s->'camperNames', '[]'::jsonb)) > 0 THEN s->'camperNames'
    ELSE jsonb_build_array(s->>'name')
  END
) AS rn(name)
WHERE lower(trim(rn.name)) IN (SELECT name_key FROM needles)
   OR lower(trim(s->>'address')) LIKE '%33%wood%'
ORDER BY bus, camper_on_stop;


-- 6c) Unplotted / purple-pin bucket
WITH params AS (
  SELECT c.id AS company_id, '2027'::text AS season
  FROM companies c WHERE c.slug = 'north-shore-day-camp'
)
SELECT
  u->>'name' AS name,
  trim(u->>'address') AS address,
  u->>'lat' AS lat,
  u->>'lng' AS lng
FROM transport_boards tb
JOIN params p ON p.company_id = tb.company_id AND tb.season = p.season,
LATERAL jsonb_array_elements(COALESCE(tb.data->'unplottedCampers', '[]'::jsonb)) AS u
WHERE lower(trim(u->>'name')) LIKE '%corn%'
   OR lower(trim(u->>'name')) LIKE '%korn%'
   OR lower(trim(u->>'address')) LIKE '%33%wood%';
