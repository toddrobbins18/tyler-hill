-- Restore North Shore 2027 Parent Transport list (Todd, Oct 2026).
-- Campers: Andi Robbins, Cali Robbins, Alina Haynes, Carter Haynes, Cole Mercado
--
-- Run in Supabase SQL Editor on PRODUCTION only after reviewing step 1 + 2.
-- Company: North Shore day camp

-- CampMinder person_id (from Todd grade/guardian files — matches enrolled 2027 children)
-- 15899187 Andi Robbins | 13312484 Cali Robbins | 16421701 Alina Haynes
-- 14964644 Carter Haynes | 19653114 Cole Mercado

-- 1) Verify all five resolve in children (must be 5 rows)
SELECT
  ch.person_id,
  ch.id AS child_id,
  ch.name,
  ch.season,
  ch.status
FROM public.children ch
WHERE ch.company_id = '0d98861f-d956-4bfb-b273-851b3ae56d5c'
  AND ch.season = '2027'
  AND ch.person_id IN (
    '15899187', '13312484', '16421701', '14964644', '19653114'
  )
ORDER BY ch.name;

-- 2) Preview parentTransportCampers JSON that will be written
WITH pt_children AS (
  SELECT ch.id, ch.name, ch.person_id
  FROM public.children ch
  WHERE ch.company_id = '0d98861f-d956-4bfb-b273-851b3ae56d5c'
    AND ch.season = '2027'
    AND ch.person_id IN (
      '15899187', '13312484', '16421701', '14964644', '19653114'
    )
),
numbered AS (
  SELECT
    id,
    name,
    500 + row_number() OVER (ORDER BY name) AS pt_id
  FROM pt_children
),
pt_json AS (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', pt_id,
      'childId', id::text,
      'name', name,
      'routeId', null,
      'am', true,
      'pm', true,
      'weekdays', '[]'::jsonb,
      'notes', null
    )
    ORDER BY name
  ) AS arr
  FROM numbered
)
SELECT arr, jsonb_array_length(arr) AS pt_count FROM pt_json;

-- 3) APPLY — merge PT array into 2027 board (keeps rest of data JSON intact)
-- Uncomment the block below after steps 1–2 look correct.

/*
WITH pt_children AS (
  SELECT ch.id, ch.name
  FROM public.children ch
  WHERE ch.company_id = '0d98861f-d956-4bfb-b273-851b3ae56d5c'
    AND ch.season = '2027'
    AND ch.person_id IN (
      '15899187', '13312484', '16421701', '14964644', '19653114'
    )
),
numbered AS (
  SELECT
    id,
    name,
    500 + row_number() OVER (ORDER BY name) AS pt_id
  FROM pt_children
),
new_pt AS (
  SELECT jsonb_agg(
    jsonb_build_object(
      'id', pt_id,
      'childId', id::text,
      'name', name,
      'routeId', null,
      'am', true,
      'pm', true,
      'weekdays', '[]'::jsonb,
      'notes', null
    )
    ORDER BY name
  ) AS arr
  FROM numbered
)
UPDATE public.transport_boards t
SET
  data = jsonb_set(
    COALESCE(t.data, '{}'::jsonb),
    '{parentTransportCampers}',
    COALESCE((SELECT arr FROM new_pt), '[]'::jsonb),
    true
  ),
  updated_at = now()
WHERE t.company_id = '0d98861f-d956-4bfb-b273-851b3ae56d5c'
  AND t.season = '2027'
  AND (SELECT COUNT(*) FROM pt_children) = 5;

-- 4) Confirm (same as verify_transport_board_north_shore.sql §3b)
SELECT
  pt.elem->>'name' AS camper_name,
  pt.elem->>'childId' AS child_id,
  pt.elem->>'routeId' AS route_id,
  pt.elem->>'am' AS am,
  pt.elem->>'pm' AS pm
FROM public.transport_boards t
CROSS JOIN LATERAL jsonb_array_elements(t.data->'parentTransportCampers') pt(elem)
WHERE t.company_id = '0d98861f-d956-4bfb-b273-851b3ae56d5c'
  AND t.season = '2027'
ORDER BY pt.elem->>'name';
*/
