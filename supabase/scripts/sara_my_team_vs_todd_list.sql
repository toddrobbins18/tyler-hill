-- Sara (Sarah Pitre) "My Team" audit — compare UI (23) vs Todd's list (19)
-- Tyler Hill 2026
--
-- Sara user_id:  63565eac-7524-4c82-9f66-3436da89e8c3
-- Sara staff_id: e12b8a60-d23e-4ced-a72b-e7deee271af0
-- Tyler Hill:    0d0b7f4f-327e-4497-83ff-3aa501ffc295

-- =============================================================================
-- 1) What the Staff PAGE shows Sara (mirrors Staff.tsx filter logic)
--    Expected: 23 of 344
-- =============================================================================

WITH sara AS (
  SELECT
    'e12b8a60-d23e-4ced-a72b-e7deee271af0'::uuid AS staff_id,
    '63565eac-7524-4c82-9f66-3436da89e8c3'::uuid AS user_id
),
sara_sports AS (
  SELECT ARRAY_AGG(DISTINCT ssa.sport) AS sports
  FROM public.specialist_sport_assignments ssa
  CROSS JOIN sara
  WHERE ssa.user_id = sara.user_id
    AND ssa.company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
),
sara_sla AS (
  SELECT ARRAY_AGG(sla.staff_id) AS staff_ids
  FROM public.staff_leader_assignments sla
  CROSS JOIN sara
  WHERE sla.leader_id = sara.staff_id
    AND sla.company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
    AND sla.season = '2026'
),
active_staff AS (
  SELECT s.*
  FROM public.staff s
  WHERE s.company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
    AND s.season = '2026'
    AND s.name IS NOT NULL
    AND s.name <> 'Unknown'
    AND COALESCE(LOWER(s.status), 'active') NOT IN ('inactive')
)
SELECT
  a.name,
  a.role,
  a.status,
  a.leader_id = (SELECT staff_id FROM sara) AS direct_report,
  a.id = ANY(COALESCE((SELECT staff_ids FROM sara_sla), ARRAY[]::uuid[])) AS in_sla,
  EXISTS (
    SELECT 1
    FROM unnest(COALESCE(a.specialty_sports, ARRAY[]::text[])) AS ms(sport)
    JOIN unnest(COALESCE((SELECT sports FROM sara_sports), ARRAY[]::text[])) AS ss(sport)
      ON ms.sport = ss.sport
  ) AS sport_match,
  CASE
    WHEN a.id = (SELECT staff_id FROM sara) THEN 'self'
    WHEN a.id = ANY(COALESCE((SELECT staff_ids FROM sara_sla), ARRAY[]::uuid[])) THEN 'staff_leader_assignments'
    WHEN a.leader_id = (SELECT staff_id FROM sara) THEN 'leader_id'
    WHEN EXISTS (
      SELECT 1
      FROM unnest(COALESCE(a.specialty_sports, ARRAY[]::text[])) AS ms(sport)
      JOIN unnest(COALESCE((SELECT sports FROM sara_sports), ARRAY[]::text[])) AS ss(sport)
        ON ms.sport = ss.sport
    ) THEN 'specialist_sport_assignments'
    ELSE 'hidden'
  END AS visible_via
FROM active_staff a
CROSS JOIN sara
WHERE a.id = sara.staff_id
   OR a.id = ANY(COALESCE((SELECT staff_ids FROM sara_sla), ARRAY[]::uuid[]))
   OR a.leader_id = sara.staff_id
   OR EXISTS (
     SELECT 1
     FROM unnest(COALESCE(a.specialty_sports, ARRAY[]::text[])) AS ms(sport)
     JOIN unnest(COALESCE((SELECT sports FROM sara_sports), ARRAY[]::text[])) AS ss(sport)
       ON ms.sport = ss.sport
   )
ORDER BY a.name;

-- Count only (should be 23)
WITH sara AS (
  SELECT 'e12b8a60-d23e-4ced-a72b-e7deee271af0'::uuid AS staff_id,
         '63565eac-7524-4c82-9f66-3436da89e8c3'::uuid AS user_id
),
sara_sports AS (
  SELECT ARRAY_AGG(DISTINCT sport) AS sports
  FROM public.specialist_sport_assignments
  WHERE user_id = (SELECT user_id FROM sara)
    AND company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
),
sara_sla AS (
  SELECT ARRAY_AGG(staff_id) AS staff_ids
  FROM public.staff_leader_assignments
  WHERE leader_id = (SELECT staff_id FROM sara)
    AND company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
    AND season = '2026'
)
SELECT COUNT(*) AS sara_my_team_count
FROM public.staff s
CROSS JOIN sara
WHERE s.company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND s.season = '2026'
  AND s.name IS NOT NULL AND s.name <> 'Unknown'
  AND COALESCE(LOWER(s.status), 'active') NOT IN ('inactive')
  AND (
    s.id = sara.staff_id
    OR s.id = ANY(COALESCE((SELECT staff_ids FROM sara_sla), ARRAY[]::uuid[]))
    OR s.leader_id = sara.staff_id
    OR EXISTS (
      SELECT 1 FROM unnest(COALESCE(s.specialty_sports, ARRAY[]::text[])) ms(sport)
      JOIN unnest(COALESCE((SELECT sports FROM sara_sports), ARRAY[]::text[])) ss(sport)
        ON ms.sport = ss.sport
    )
  );

-- =============================================================================
-- 2) Todd's 19 — each person: active? assigned? visible to Sara?
-- =============================================================================

WITH sara AS (
  SELECT 'e12b8a60-d23e-4ced-a72b-e7deee271af0'::uuid AS staff_id,
         '63565eac-7524-4c82-9f66-3436da89e8c3'::uuid AS user_id
),
expected (name) AS (
  VALUES
    ('Aidan Casey'), ('Amelie Lovelock'), ('Callum Skelly'), ('Cooper Flaum'),
    ('Evelyn Cant'), ('Evie Wildish'), ('Freddie Kinder'), ('Hannah Wiles'),
    ('Harvey Jager'), ('Holly Makin'), ('Jack Pool'), ('Luke Holland'),
    ('Megan Hollinger'), ('Miriam Aparicio'), ('Poppy Hogg'), ('Steven Fina'),
    ('William Shaw'), ('Jack Mooney'), ('Alex Smith')
),
sara_sports AS (
  SELECT ARRAY_AGG(DISTINCT sport) AS sports
  FROM public.specialist_sport_assignments
  WHERE user_id = (SELECT user_id FROM sara)
    AND company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
)
SELECT
  e.name AS todd_name,
  s.status,
  s.leader_id = (SELECT staff_id FROM sara) AS leader_is_sara,
  EXISTS (
    SELECT 1 FROM public.staff_leader_assignments sla
    WHERE sla.staff_id = s.id AND sla.leader_id = (SELECT staff_id FROM sara)
      AND sla.season = '2026'
  ) AS in_sla,
  CASE
    WHEN s.id IS NULL THEN 'MISSING FROM DB'
    WHEN COALESCE(LOWER(s.status), 'active') = 'inactive' THEN 'INACTIVE (hidden)'
    WHEN s.id = (SELECT staff_id FROM sara) THEN 'N/A (Sara herself)'
    WHEN s.leader_id = (SELECT staff_id FROM sara)
      OR EXISTS (
        SELECT 1 FROM public.staff_leader_assignments sla
        WHERE sla.staff_id = s.id AND sla.leader_id = (SELECT staff_id FROM sara) AND sla.season = '2026'
      )
      OR EXISTS (
        SELECT 1 FROM unnest(COALESCE(s.specialty_sports, ARRAY[]::text[])) ms(sport)
        JOIN unnest(COALESCE((SELECT sports FROM sara_sports), ARRAY[]::text[])) ss(sport) ON ms.sport = ss.sport
      )
    THEN 'VISIBLE TO SARA'
    ELSE 'NOT VISIBLE TO SARA'
  END AS sara_sees
FROM expected e
LEFT JOIN public.staff s
  ON s.name ILIKE e.name
 AND s.season = '2026'
 AND s.company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
ORDER BY sara_sees, e.name;

-- =============================================================================
-- 3) EXTRAS — Sara sees these but NOT on Todd's list (the +4 problem)
-- =============================================================================

WITH sara AS (
  SELECT 'e12b8a60-d23e-4ced-a72b-e7deee271af0'::uuid AS staff_id,
         '63565eac-7524-4c82-9f66-3436da89e8c3'::uuid AS user_id
),
expected_names (name) AS (
  VALUES
    ('Aidan Casey'), ('Amelie Lovelock'), ('Callum Skelly'), ('Cooper Flaum'),
    ('Evelyn Cant'), ('Evie Wildish'), ('Freddie Kinder'), ('Hannah Wiles'),
    ('Harvey Jager'), ('Holly Makin'), ('Jack Pool'), ('Luke Holland'),
    ('Megan Hollinger'), ('Miriam Aparicio'), ('Poppy Hogg'), ('Steven Fina'),
    ('William Shaw'), ('Jack Mooney'), ('Alex Smith'), ('Sarah Pitre')
),
sara_sports AS (
  SELECT ARRAY_AGG(DISTINCT sport) AS sports
  FROM public.specialist_sport_assignments
  WHERE user_id = (SELECT user_id FROM sara)
    AND company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
),
sara_sla AS (
  SELECT ARRAY_AGG(staff_id) AS staff_ids
  FROM public.staff_leader_assignments
  WHERE leader_id = (SELECT staff_id FROM sara)
    AND company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
    AND season = '2026'
),
sara_visible AS (
  SELECT s.id, s.name, s.role, s.leader_id, s.specialty_sports
  FROM public.staff s
  CROSS JOIN sara
  WHERE s.company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
    AND s.season = '2026'
    AND COALESCE(LOWER(s.status), 'active') NOT IN ('inactive')
    AND s.name IS NOT NULL AND s.name <> 'Unknown'
    AND (
      s.id = sara.staff_id
      OR s.id = ANY(COALESCE((SELECT staff_ids FROM sara_sla), ARRAY[]::uuid[]))
      OR s.leader_id = sara.staff_id
      OR EXISTS (
        SELECT 1 FROM unnest(COALESCE(s.specialty_sports, ARRAY[]::text[])) ms(sport)
        JOIN unnest(COALESCE((SELECT sports FROM sara_sports), ARRAY[]::text[])) ss(sport) ON ms.sport = ss.sport
      )
    )
)
SELECT
  v.name,
  v.role,
  v.leader_id = (SELECT staff_id FROM sara) AS via_leader_id,
  v.id = ANY(COALESCE((SELECT staff_ids FROM sara_sla), ARRAY[]::uuid[])) AS via_sla,
  v.specialty_sports,
  (SELECT sports FROM sara_sports) AS sara_assigned_sports
FROM sara_visible v
WHERE NOT EXISTS (
  SELECT 1 FROM expected_names en WHERE v.name ILIKE en.name
)
ORDER BY v.name;

-- =============================================================================
-- 4) MISSING — on Todd's list but Sara does NOT see
-- =============================================================================

WITH sara AS (
  SELECT 'e12b8a60-d23e-4ced-a72b-e7deee271af0'::uuid AS staff_id,
         '63565eac-7524-4c82-9f66-3436da89e8c3'::uuid AS user_id
),
expected (name) AS (
  VALUES
    ('Aidan Casey'), ('Amelie Lovelock'), ('Callum Skelly'), ('Cooper Flaum'),
    ('Evelyn Cant'), ('Evie Wildish'), ('Freddie Kinder'), ('Hannah Wiles'),
    ('Harvey Jager'), ('Holly Makin'), ('Jack Pool'), ('Luke Holland'),
    ('Megan Hollinger'), ('Miriam Aparicio'), ('Poppy Hogg'), ('Steven Fina'),
    ('William Shaw'), ('Jack Mooney'), ('Alex Smith')
),
sara_sports AS (
  SELECT ARRAY_AGG(DISTINCT sport) AS sports
  FROM public.specialist_sport_assignments
  WHERE user_id = (SELECT user_id FROM sara)
    AND company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
),
sara_sla AS (
  SELECT ARRAY_AGG(staff_id) AS staff_ids
  FROM public.staff_leader_assignments
  WHERE leader_id = (SELECT staff_id FROM sara)
    AND company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
    AND season = '2026'
)
SELECT
  e.name,
  s.status,
  s.leader_id,
  CASE WHEN s.leader_id = (SELECT staff_id FROM sara) THEN 'fix: already leader_id' END AS note
FROM expected e
LEFT JOIN public.staff s
  ON s.name ILIKE e.name
 AND s.season = '2026'
 AND s.company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
WHERE s.id IS NULL
   OR COALESCE(LOWER(s.status), 'active') = 'inactive'
   OR (
     s.id <> (SELECT staff_id FROM sara)
     AND s.id <> ALL(COALESCE((SELECT staff_ids FROM sara_sla), ARRAY[]::uuid[]))
     AND s.leader_id IS DISTINCT FROM (SELECT staff_id FROM sara)
     AND NOT EXISTS (
       SELECT 1 FROM unnest(COALESCE(s.specialty_sports, ARRAY[]::text[])) ms(sport)
       JOIN unnest(COALESCE((SELECT sports FROM sara_sports), ARRAY[]::text[])) ss(sport) ON ms.sport = ss.sport
     )
   )
ORDER BY e.name;

-- =============================================================================
-- 5) Sara's assignment config (debug)
-- =============================================================================

SELECT 'specialist_sport_assignments' AS source, sport AS detail
FROM public.specialist_sport_assignments
WHERE user_id = '63565eac-7524-4c82-9f66-3436da89e8c3'
  AND company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
UNION ALL
SELECT 'staff_leader_assignments', st.name
FROM public.staff_leader_assignments sla
JOIN public.staff st ON st.id = sla.staff_id
WHERE sla.leader_id = 'e12b8a60-d23e-4ced-a72b-e7deee271af0'
  AND sla.season = '2026'
UNION ALL
SELECT 'leader_id direct reports', name
FROM public.staff
WHERE leader_id = 'e12b8a60-d23e-4ced-a72b-e7deee271af0'
  AND season = '2026'
  AND company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
ORDER BY source, detail;
