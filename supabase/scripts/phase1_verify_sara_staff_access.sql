-- PHASE 1: Verify Sarah Pitre access + Todd's assigned team list (Tyler Hill 2026)
--
-- Sarah user_id:  63565eac-7524-4c82-9f66-3436da89e8c3
-- Sarah staff_id: e12b8a60-d23e-4ced-a72b-e7deee271af0
-- Tyler Hill:     0d0b7f4f-327e-4497-83ff-3aa501ffc295
--
-- Run all sections in Supabase SQL Editor. Read-only.

-- ── A) Sarah's login / access ───────────────────────────────────────────────

SELECT id, email, company_id, approved
FROM public.profiles
WHERE id = '63565eac-7524-4c82-9f66-3436da89e8c3';

SELECT user_id, role, company_id
FROM public.user_roles
WHERE user_id = '63565eac-7524-4c82-9f66-3436da89e8c3';

SELECT company_id, role, menu_item, can_access
FROM public.role_permissions
WHERE role = 'specialist'
  AND menu_item = 'staff'
  AND company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid;

SELECT id, name, email, status, company_id, season, specialty_sports, leader_id
FROM public.staff
WHERE id = 'e12b8a60-d23e-4ced-a72b-e7deee271af0'
   OR (email ILIKE 'sarepitre@gmail.com' AND season = '2026');

SELECT COUNT(*) AS tyler_hill_active_staff_2026
FROM public.staff
WHERE company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND season = '2026'
  AND COALESCE(LOWER(status), 'active') NOT IN ('inactive');

-- ── B) Todd's list — each person vs DB + assignment to Sarah ───────────────

WITH sara AS (
  SELECT id AS leader_id, name
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
    en.first_name,
    en.last_name,
    s.id AS staff_id,
    s.name AS db_name,
    s.role,
    s.status,
    s.company_id,
    c.name AS company_name,
    s.leader_id,
    (s.leader_id = (SELECT leader_id FROM sara)) AS leader_id_is_sara
  FROM expected_names en
  LEFT JOIN public.staff s
    ON s.season = '2026'
   AND s.name ILIKE en.first_name || ' ' || en.last_name || '%'
  LEFT JOIN public.companies c ON c.id = s.company_id
)
SELECT
  m.first_name || ' ' || m.last_name AS expected_name,
  m.db_name,
  m.role,
  m.status,
  m.company_name,
  m.leader_id_is_sara,
  EXISTS (
    SELECT 1
    FROM public.staff_leader_assignments sla
    WHERE sla.staff_id = m.staff_id
      AND sla.leader_id = (SELECT leader_id FROM sara)
      AND sla.season = '2026'
      AND sla.company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  ) AS in_staff_leader_assignments,
  CASE
    WHEN m.staff_id IS NULL THEN 'NOT IN DB'
    WHEN m.company_id IS DISTINCT FROM '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid THEN 'WRONG COMPANY'
    WHEN COALESCE(LOWER(m.status), 'active') = 'inactive' THEN 'INACTIVE'
    WHEN NOT m.leader_id_is_sara
      AND NOT EXISTS (
        SELECT 1 FROM public.staff_leader_assignments sla
        WHERE sla.staff_id = m.staff_id
          AND sla.leader_id = (SELECT leader_id FROM sara)
          AND sla.season = '2026'
      ) THEN 'NOT ASSIGNED TO SARA'
    ELSE 'OK'
  END AS check_result
FROM matched m
ORDER BY check_result, m.last_name, m.first_name;

-- ── C) Summary counts ───────────────────────────────────────────────────────

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
    ('Aidan', 'Casey'), ('Amelie', 'Lovelock'), ('Callum', 'Skelly'), ('Cooper', 'Flaum'),
    ('Evelyn', 'Cant'), ('Evie', 'Wildish'), ('Freddie', 'Kinder'), ('Hannah', 'Wiles'),
    ('Harvey', 'Jager'), ('Holly', 'Makin'), ('Jack', 'Pool'), ('Luke', 'Holland'),
    ('Megan', 'Hollinger'), ('Miriam', 'Aparicio'), ('Poppy', 'Hogg'), ('Steven', 'Fina'),
    ('William', 'Shaw'), ('Jack', 'Mooney'), ('Alex', 'Smith')
),
matched AS (
  SELECT s.id AS staff_id, s.company_id, s.status, s.leader_id
  FROM expected_names en
  JOIN public.staff s
    ON s.season = '2026'
   AND s.name ILIKE en.first_name || ' ' || en.last_name || '%'
)
SELECT
  (SELECT COUNT(*) FROM expected_names) AS todd_list_count,
  (SELECT COUNT(*) FROM matched) AS found_in_db,
  (SELECT COUNT(*) FROM matched
   WHERE company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid) AS on_tyler_hill,
  (SELECT COUNT(*) FROM matched m
   WHERE company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
     AND COALESCE(LOWER(m.status), 'active') NOT IN ('inactive')) AS active_on_tyler_hill,
  (SELECT COUNT(*) FROM public.staff_leader_assignments sla
   WHERE sla.leader_id = (SELECT leader_id FROM sara)
     AND sla.season = '2026'
     AND sla.company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid) AS sla_rows_for_sara,
  (SELECT COUNT(*) FROM matched m
   WHERE m.leader_id = (SELECT leader_id FROM sara)
      OR EXISTS (
        SELECT 1 FROM public.staff_leader_assignments sla
        WHERE sla.staff_id = m.staff_id
          AND sla.leader_id = (SELECT leader_id FROM sara)
          AND sla.season = '2026'
      )) AS todd_list_assigned_to_sara;

-- ── D) Anyone assigned to Sara NOT on Todd's list? ──────────────────────────

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
    ('Aidan', 'Casey'), ('Amelie', 'Lovelock'), ('Callum', 'Skelly'), ('Cooper', 'Flaum'),
    ('Evelyn', 'Cant'), ('Evie', 'Wildish'), ('Freddie', 'Kinder'), ('Hannah', 'Wiles'),
    ('Harvey', 'Jager'), ('Holly', 'Makin'), ('Jack', 'Pool'), ('Luke', 'Holland'),
    ('Megan', 'Hollinger'), ('Miriam', 'Aparicio'), ('Poppy', 'Hogg'), ('Steven', 'Fina'),
    ('William', 'Shaw'), ('Jack', 'Mooney'), ('Alex', 'Smith'), ('Sarah', 'Pitre')
),
sara_team AS (
  SELECT st.id, st.name, st.role, 'leader_id' AS via
  FROM public.staff st
  CROSS JOIN sara
  WHERE st.leader_id = sara.leader_id
    AND st.season = '2026'
    AND st.company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  UNION
  SELECT st.id, st.name, st.role, 'staff_leader_assignments' AS via
  FROM public.staff_leader_assignments sla
  JOIN public.staff st ON st.id = sla.staff_id
  CROSS JOIN sara
  WHERE sla.leader_id = sara.leader_id
    AND sla.season = '2026'
    AND sla.company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
)
SELECT t.name, t.role, t.via
FROM sara_team t
WHERE NOT EXISTS (
  SELECT 1 FROM expected_names en
  WHERE t.name ILIKE en.first_name || ' ' || en.last_name || '%'
)
ORDER BY t.name;

-- Fix profile company if needed:
-- UPDATE public.profiles SET company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
-- WHERE id = '63565eac-7524-4c82-9f66-3436da89e8c3';
--
-- After review, apply assignments: phase1_backfill_sara_pitre_team.sql
