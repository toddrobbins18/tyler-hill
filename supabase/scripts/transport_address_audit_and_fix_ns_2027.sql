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
            SELECT c.home_address AS new_address
            FROM (
              SELECT cr.home_address, cr.home_key, count(*) AS matched
              FROM jsonb_array_elements_text(
                CASE
                  WHEN jsonb_array_length(COALESCE(elem->'camperNames', '[]'::jsonb)) > 0
                    THEN elem->'camperNames'
                  ELSE jsonb_build_array(NULLIF(elem->>'name', ''))
                END
              ) AS rn(name)
              JOIN child_roster cr ON cr.name_key = lower(trim(rn.name))
              WHERE trim(rn.name) <> ''
              GROUP BY cr.home_key, cr.home_address
            ) c
            WHERE c.matched = (
              SELECT count(*)
              FROM jsonb_array_elements_text(
                CASE
                  WHEN jsonb_array_length(COALESCE(elem->'camperNames', '[]'::jsonb)) > 0
                    THEN elem->'camperNames'
                  ELSE jsonb_build_array(NULLIF(elem->>'name', ''))
                END
              ) AS rn2(name)
              WHERE trim(rn2.name) <> ''
            )
            AND lower(trim(regexp_replace(trim(COALESCE(elem->>'address', '')), '\s+', ' ', 'g')))
                IS DISTINCT FROM c.home_key
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
