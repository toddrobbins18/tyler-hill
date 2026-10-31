-- Relink season 2026 swim rows when child_id points at another season's row
-- but the camper name matches a 2026 children row (person_id missing or mismatched).
-- Run verify_swim_program_records_2026.sql first.

WITH company AS (
  SELECT id FROM companies WHERE slug = 'north-shore-day-camp' LIMIT 1
),
to_relink AS (
  SELECT DISTINCT ON (s.id)
    s.id AS record_id,
    ch_target.id AS new_child_id,
    coalesce(nullif(trim(s.person_id), ''), ch_target.person_id::text) AS new_person_id
  FROM swim_program_records s
  CROSS JOIN company co
  JOIN children ch_wrong
    ON ch_wrong.id = s.child_id
   AND ch_wrong.company_id = co.id
  JOIN children ch_target
    ON ch_target.company_id = co.id
   AND ch_target.season = s.season
   AND lower(trim(ch_target.name)) = lower(trim(ch_wrong.name))
  WHERE s.company_id = co.id
    AND s.season = '2026'
    AND ch_wrong.season IS DISTINCT FROM s.season
    AND s.child_id <> ch_target.id
  ORDER BY s.id, ch_target.id
),
updated AS (
  UPDATE swim_program_records spr
  SET
    child_id = r.new_child_id,
    person_id = r.new_person_id
  FROM to_relink r
  WHERE spr.id = r.record_id
  RETURNING spr.id
)
SELECT count(*) AS rows_relinked_by_name FROM updated;
