-- Harris Goldberg — roster is 121 Salem; board may still show Woodbury until this runs.
-- Patches transport_boards for 2026 + 2027 from children.home_address, resets lat/lng.
-- Then: Transport → Re-geocode All Placements (each season).

BEGIN;

UPDATE children ch
SET
  home_address = '121 Salem Rd, Roslyn Heights, NY 11577',
  updated_at = now()
FROM companies co
WHERE co.slug = 'north-shore-day-camp'
  AND ch.company_id = co.id
  AND ch.season IN ('2026', '2027')
  AND (
    ch.person_id = '15965489'
    OR lower(trim(ch.name)) = 'harris goldberg'
  );

WITH params AS (
  SELECT c.id AS company_id
  FROM companies c
  WHERE c.slug = 'north-shore-day-camp'
),
child_roster AS (
  SELECT
    ch.season,
    lower(trim(ch.name)) AS name_key,
    trim(ch.home_address) AS home_address,
    lower(trim(regexp_replace(trim(ch.home_address), '\s+', ' ', 'g'))) AS home_key
  FROM children ch
  JOIN params p ON p.company_id = ch.company_id
  WHERE ch.season IN ('2026', '2027')
    AND ch.status IS DISTINCT FROM 'inactive'
    AND ch.home_address IS NOT NULL
    AND trim(ch.home_address) <> ''
),
target AS (
  SELECT tb.company_id, tb.season, tb.data
  FROM transport_boards tb
  JOIN params p ON p.company_id = tb.company_id
  WHERE tb.season IN ('2026', '2027')
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
            WHERE cr.season = t.season
              AND (
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
        LEFT JOIN child_roster cr
          ON cr.name_key = lower(trim(u->>'name'))
         AND cr.season = t.season
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

COMMIT;

-- Board check (same as verify_harris_goldberg_address.sql tail)
WITH params AS (
  SELECT c.id AS company_id FROM companies c WHERE c.slug = 'north-shore-day-camp' LIMIT 1
)
SELECT tb.season, route.route_id, trim(s->>'address') AS board_address, s->>'lat' AS lat, s->>'lng' AS lng
FROM transport_boards tb
JOIN params p ON p.company_id = tb.company_id,
LATERAL jsonb_each(COALESCE(tb.data->'coreStops', '{}'::jsonb)) AS route(route_id, stops),
LATERAL jsonb_array_elements(stops) AS s,
LATERAL jsonb_array_elements_text(
  CASE
    WHEN jsonb_array_length(COALESCE(s->'camperNames', '[]'::jsonb)) > 0 THEN s->'camperNames'
    ELSE jsonb_build_array(s->>'name')
  END
) AS rn(name)
WHERE tb.season IN ('2026', '2027')
  AND lower(trim(rn.name)) = 'harris goldberg';
