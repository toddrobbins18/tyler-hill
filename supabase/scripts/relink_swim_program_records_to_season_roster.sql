-- Point swim_program_records at the children row for the same season + person_id.
-- Run after CSV import if Swim Bracelets / Level Report look empty for season 2026
-- but import reported hundreds of matches (records were saved on another season's child_id).
--
-- North Shore (adjust slug if needed). Run the whole script in Supabase SQL Editor.

WITH company AS (
  SELECT id FROM companies WHERE slug = 'north-shore-day-camp' LIMIT 1
),
to_relink AS (
  SELECT
    spr.id AS record_id,
    ch.id AS new_child_id,
    COALESCE(NULLIF(trim(spr.person_id), ''), ch.person_id::text) AS new_person_id
  FROM swim_program_records spr
  CROSS JOIN company co
  JOIN children ch_wrong
    ON ch_wrong.id = spr.child_id
   AND ch_wrong.company_id = co.id
  JOIN children ch
    ON ch.company_id = co.id
   AND ch.season = spr.season
   AND ch.person_id IS NOT NULL
   AND ch.person_id::text = COALESCE(NULLIF(trim(spr.person_id), ''), ch_wrong.person_id::text)
  WHERE spr.company_id = co.id
    AND spr.child_id <> ch.id
),
updated AS (
  UPDATE swim_program_records spr
  SET
    child_id = r.new_child_id,
    person_id = r.new_person_id
  FROM to_relink r
  WHERE spr.id = r.record_id
  RETURNING spr.id, spr.season, spr.child_id, spr.person_id
)
SELECT count(*) AS rows_relinked FROM updated;
