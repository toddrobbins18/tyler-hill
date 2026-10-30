-- Harris Goldberg (CampMinder person_id 15965489) — transport address check
-- Expected: 121 Salem Rd, Roslyn Heights, NY 11577 (2026 MapPoint + CampMinder)

WITH params AS (
  SELECT c.id AS company_id
  FROM companies c
  WHERE c.slug = 'north-shore-day-camp'
  LIMIT 1
)
SELECT
  ch.season,
  ch.name,
  ch.person_id,
  ch.group_name,
  ch.home_address AS roster_home_address,
  CASE
    WHEN lower(trim(regexp_replace(COALESCE(ch.home_address, ''), '\s+', ' ', 'g')))
      = lower('121 Salem Rd, Roslyn Heights, NY 11577')
    THEN 'matches CampMinder / MapPoint'
    WHEN ch.home_address IS NULL OR trim(ch.home_address) = ''
    THEN 'MISSING — map falls back to old board / MapPoint hints only'
    ELSE 'MISMATCH — map uses this, not 121 Salem'
  END AS status
FROM children ch
JOIN params p ON p.company_id = ch.company_id
WHERE ch.person_id = '15965489'
   OR lower(trim(ch.name)) = 'harris goldberg'
ORDER BY ch.season;

-- Where he appears on the saved transport board (address + pin)
WITH params AS (
  SELECT c.id AS company_id
  FROM companies c
  WHERE c.slug = 'north-shore-day-camp'
  LIMIT 1
)
SELECT
  tb.season,
  'on_route' AS location,
  route.route_id,
  rn.name AS camper_name,
  trim(s->>'address') AS board_address,
  (s->>'lat')::text AS lat,
  (s->>'lng')::text AS lng
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
WHERE lower(trim(rn.name)) = 'harris goldberg'

UNION ALL

SELECT
  tb.season,
  'unplotted',
  NULL,
  u->>'name',
  trim(u->>'address'),
  u->>'lat',
  u->>'lng'
FROM transport_boards tb
JOIN params p ON p.company_id = tb.company_id,
LATERAL jsonb_array_elements(COALESCE(tb.data->'unplottedCampers', '[]'::jsonb)) AS u
WHERE lower(trim(u->>'name')) = 'harris goldberg'
ORDER BY season, location;

-- Fix roster + refresh board: run fix_harris_goldberg_address.sql, then in Transport
-- use "Fix Addresses from CampMinder" and "Re-geocode All Placements" for 2026 and 2027.
