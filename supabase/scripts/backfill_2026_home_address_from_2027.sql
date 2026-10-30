-- Copy home_address from 2027 → 2026 when 2026 is blank (North Shore transport / CampMinder gap).
-- Preview first; then uncomment UPDATE.

-- Preview
SELECT
  c26.name,
  c26.season AS from_season,
  c27.season AS source_season,
  c26.home_address AS current_2026,
  c27.home_address AS would_copy_from_2027
FROM children c26
JOIN children c27
  ON c27.company_id = c26.company_id
  AND c27.season = '2027'
  AND c27.home_address IS NOT NULL
  AND trim(c27.home_address) <> ''
  AND (
    (c26.person_id IS NOT NULL AND c27.person_id = c26.person_id)
    OR lower(trim(c26.name)) = lower(trim(c27.name))
  )
WHERE c26.company_id = (SELECT id FROM companies WHERE slug = 'north-shore-day-camp' LIMIT 1)
  AND c26.season = '2026'
  AND (c26.home_address IS NULL OR trim(c26.home_address) = '')
ORDER BY c26.name;

/*
UPDATE children c26
SET home_address = c27.home_address
FROM children c27
WHERE c26.company_id = c27.company_id
  AND c26.season = '2026'
  AND c27.season = '2027'
  AND (c26.home_address IS NULL OR trim(c26.home_address) = '')
  AND c27.home_address IS NOT NULL
  AND trim(c27.home_address) <> ''
  AND (
    (c26.person_id IS NOT NULL AND c27.person_id = c26.person_id)
    OR lower(trim(c26.name)) = lower(trim(c27.name))
  )
  AND c26.company_id = (SELECT id FROM companies WHERE slug = 'north-shore-day-camp' LIMIT 1);
*/
