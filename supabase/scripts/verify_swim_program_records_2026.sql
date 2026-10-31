-- Diagnostic: why Swim Program season 2026 looks empty after import.
-- Run in Supabase SQL Editor (North Shore). Read-only.

WITH company AS (
  SELECT id FROM companies WHERE slug = 'north-shore-day-camp' LIMIT 1
),
spr AS (
  SELECT s.*
  FROM swim_program_records s
  CROSS JOIN company c
  WHERE s.company_id = c.id
    AND s.season = '2026'
)
SELECT
  (SELECT count(*) FROM spr) AS total_2026_records,
  (SELECT count(*)
   FROM spr s
   JOIN children ch ON ch.id = s.child_id AND ch.season = s.season AND ch.company_id = s.company_id
  ) AS linked_to_same_season_child,
  (SELECT count(*)
   FROM spr s
   LEFT JOIN children ch ON ch.id = s.child_id
   WHERE ch.id IS NULL OR ch.season IS DISTINCT FROM s.season
  ) AS child_id_mismatch_or_missing,
  (SELECT count(*)
   FROM spr s
   WHERE coalesce(nullif(trim(s.bracelet->>'currentBracelet'), ''), '') <> ''
  ) AS with_bracelet_color,
  (SELECT count(*)
   FROM spr s
   WHERE coalesce(nullif(trim(s.bracelet->>'proctor1'), ''), '') <> ''
     OR coalesce(nullif(trim(s.bracelet->>'divisionLeader'), ''), '') <> ''
  ) AS with_bracelet_test_or_leader,
  (SELECT count(*)
   FROM spr s
   WHERE s.levels IS NOT NULL
     AND s.levels::text NOT IN ('{}', 'null')
     AND (
       s.levels->'goldfish' IS NOT NULL
       OR coalesce(s.levels->>'goldfishLevel', '—') NOT IN ('', '—')
       OR coalesce(s.levels->>'redCross', '—') NOT IN ('', '—')
     )
  ) AS with_level_data;

-- Orphan sample (first 10): saved on wrong season's child_id
WITH company AS (
  SELECT id FROM companies WHERE slug = 'north-shore-day-camp' LIMIT 1
)
SELECT
  s.id,
  s.season AS swim_season,
  ch_wrong.name AS saved_via_child_name,
  ch_wrong.season AS child_row_season,
  s.person_id,
  left(coalesce(s.bracelet->>'currentBracelet', ''), 20) AS bracelet,
  left(coalesce(s.levels->>'goldfishLevel', ''), 12) AS goldfish_level
FROM swim_program_records s
CROSS JOIN company co
JOIN children ch_wrong ON ch_wrong.id = s.child_id AND ch_wrong.company_id = co.id
WHERE s.company_id = co.id
  AND s.season = '2026'
  AND ch_wrong.season IS DISTINCT FROM s.season
LIMIT 10;
