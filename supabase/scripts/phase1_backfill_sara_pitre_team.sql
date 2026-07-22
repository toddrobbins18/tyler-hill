-- PHASE 1: Backfill Sarah Pitre's team from Todd's list (Tyler Hill 2026)
-- Source: Todd Robbins staff list for Sara — NOT sport-wide Waterfront filter.
--
-- Run phase1_audit_staff_by_company.sql first.
-- Then preview, then uncomment INSERT block.

-- Tyler Hill
-- company_id: 0d0b7f4f-327e-4497-83ff-3aa501ffc295

WITH sara AS (
  SELECT id AS leader_id
  FROM public.staff
  WHERE season = '2026'
    AND company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
    AND name ILIKE 'Sarah Pitre'
  LIMIT 1
),
expected_names (first_name, last_name) AS (
  VALUES
    ('Aidan', 'Casey'),
    ('Amelie', 'Lovelock'),
    ('Callum', 'Skelly'),
    ('Cooper', 'Flaum'),
    ('Evelyn', 'Cant'),
    ('Evie', 'Wildish'),
    ('Freddie', 'Kinder'),
    ('Hannah', 'Wiles'),
    ('Harvey', 'Jager'),
    ('Holly', 'Makin'),
    ('Jack', 'Pool'),
    ('Luke', 'Holland'),
    ('Megan', 'Hollinger'),
    ('Miriam', 'Aparicio'),
    ('Poppy', 'Hogg'),
    ('Steven', 'Fina'),
    ('William', 'Shaw'),
    ('Jack', 'Mooney'),
    ('Alex', 'Smith')
),
matched AS (
  SELECT
    s.id AS staff_id,
    s.name,
    s.status,
    en.first_name,
    en.last_name
  FROM expected_names en
  JOIN public.staff s
    ON s.season = '2026'
   AND s.company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
   AND s.name ILIKE en.first_name || ' ' || en.last_name || '%'
)
-- Preview: matched vs missing from Todd's list
SELECT
  en.first_name || ' ' || en.last_name AS expected_name,
  m.name AS matched_staff,
  m.status,
  m.staff_id
FROM expected_names en
LEFT JOIN matched m
  ON m.first_name = en.first_name AND m.last_name = en.last_name
ORDER BY en.last_name, en.first_name;

-- Missing names (not found in Tyler Hill 2026 staff)
-- SELECT en.first_name || ' ' || en.last_name AS missing
-- FROM expected_names en
-- LEFT JOIN matched m ON m.first_name = en.first_name AND m.last_name = en.last_name
-- WHERE m.staff_id IS NULL;

/*
-- Apply assignments (idempotent — skips existing rows)
INSERT INTO public.staff_leader_assignments (staff_id, leader_id, company_id, season)
SELECT m.staff_id, sara.leader_id, '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid, '2026'
FROM matched m
CROSS JOIN sara
WHERE m.staff_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- Also set leader_id on staff rows for Sara's direct reports
UPDATE public.staff st
SET leader_id = sara.leader_id
FROM matched m
CROSS JOIN sara
WHERE st.id = m.staff_id
  AND (st.leader_id IS DISTINCT FROM sara.leader_id);
*/
