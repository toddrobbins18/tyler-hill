-- Roll over 2026 → 2027 for ALL camps (DEPRECATED bulk copy — use merge + CM sync instead).
--
-- Todd requirement: 2027 enrolled/hired lists come from CampMinder season 2027 ONLY.
-- 2026 rows are never modified.
--
-- Preferred flow:
--   1) merge_2026_profiles_into_2027.sql  (profile fields for matching person_id)
--   2) CampMinder sync season 2027          (creates roster + inactivates non-enrolled)
--   3) Sunshine: Reload from Roster in UI  (after groups sync)
--
-- The bulk INSERT below copies 2026 lists into 2027 — DO NOT RUN unless intentionally
-- bootstrapping before CM 2027 enrollment exists. It causes "2026 data in 2027" issues.

-- =============================================================================
-- PREVIEW (run first)
-- =============================================================================
SELECT
  c.slug,
  (SELECT COUNT(*) FROM public.children ch WHERE ch.company_id = c.id AND ch.season = '2026') AS children_2026,
  (SELECT COUNT(*) FROM public.children ch WHERE ch.company_id = c.id AND ch.season = '2027') AS children_2027,
  (SELECT COUNT(*) FROM public.staff s WHERE s.company_id = c.id AND s.season = '2026') AS staff_2026,
  (SELECT COUNT(*) FROM public.staff s WHERE s.company_id = c.id AND s.season = '2027') AS staff_2027
FROM public.companies c
WHERE c.slug IN (
  'tyler-hill-camp',
  'timber-lake-camp',
  'timber-lake-west',
  'north-shore-day-camp'
)
GROUP BY c.slug
ORDER BY c.slug;

-- =============================================================================
-- ROLLOVER
-- =============================================================================
BEGIN;

-- ----- STAFF -----
CREATE TEMP TABLE _staff_roll ON COMMIT DROP AS
SELECT
  s.id AS old_id,
  gen_random_uuid() AS new_id,
  s.company_id,
  s.person_id
FROM public.staff s
WHERE s.season = '2026'
  AND COALESCE(LOWER(s.status), 'active') NOT IN ('inactive')
  AND NOT EXISTS (
    SELECT 1
    FROM public.staff s27
    WHERE s27.company_id = s.company_id
      AND s27.season = '2027'
      AND (
        (s.person_id IS NOT NULL AND s27.person_id = s.person_id)
        OR (
          s.person_id IS NULL
          AND s27.person_id IS NULL
          AND s27.name = s.name
          AND COALESCE(s27.email, '') = COALESCE(s.email, '')
        )
      )
  );

INSERT INTO public.staff (
  id,
  name,
  role,
  department,
  status,
  email,
  phone,
  hire_date,
  company_id,
  division_id,
  gender,
  date_of_birth,
  allergies,
  person_id,
  rfid,
  photo_url,
  season,
  session,
  sort_order,
  specialty_sports,
  staff_type,
  tshirt_size,
  leader_id,
  created_at,
  updated_at
)
SELECT
  r.new_id,
  s.name,
  s.role,
  s.department,
  s.status,
  s.email,
  s.phone,
  s.hire_date,
  s.company_id,
  s.division_id,
  s.gender,
  s.date_of_birth,
  s.allergies,
  s.person_id,
  s.rfid,
  s.photo_url,
  '2027',
  s.session,
  s.sort_order,
  s.specialty_sports,
  s.staff_type,
  s.tshirt_size,
  NULL,
  now(),
  now()
FROM public.staff s
JOIN _staff_roll r ON r.old_id = s.id;

UPDATE public.staff s27
SET leader_id = lm.new_id,
    updated_at = now()
FROM _staff_roll sm
JOIN public.staff s26 ON s26.id = sm.old_id
JOIN _staff_roll lm ON lm.old_id = s26.leader_id
WHERE s27.id = sm.new_id
  AND s26.leader_id IS NOT NULL;

-- ----- CHILDREN -----
CREATE TEMP TABLE _child_roll ON COMMIT DROP AS
SELECT
  ch.id AS old_id,
  gen_random_uuid() AS new_id,
  ch.company_id,
  ch.person_id
FROM public.children ch
WHERE ch.season = '2026'
  AND COALESCE(LOWER(ch.status), 'active') NOT IN ('inactive', 'withdrawn')
  AND NOT EXISTS (
    SELECT 1
    FROM public.children ch27
    WHERE ch27.company_id = ch.company_id
      AND ch27.season = '2027'
      AND ch27.person_id = ch.person_id
  );

INSERT INTO public.children (
  id,
  name,
  age,
  grade,
  group_name,
  status,
  guardian_email,
  guardian_phone,
  guardian_name,
  guardian_name_p2,
  allergies,
  medical_notes,
  emergency_contact,
  company_id,
  division_id,
  gender,
  date_of_birth,
  category,
  bunk_id,
  leader_id,
  person_id,
  rfid,
  photo_url,
  season,
  session,
  tshirt_size,
  birthday_cake_type,
  birthday_cake_meal,
  birthday_cake_message,
  birthday_cake_allergies,
  birthday_frosting_colors,
  birthday_toppings,
  birthday_group,
  birthday_party_type,
  birthday_party_comments,
  owl_pay_balance,
  created_at,
  updated_at
)
SELECT
  r.new_id,
  ch.name,
  ch.age,
  ch.grade,
  ch.group_name,
  ch.status,
  ch.guardian_email,
  ch.guardian_phone,
  ch.guardian_name,
  ch.guardian_name_p2,
  ch.allergies,
  ch.medical_notes,
  ch.emergency_contact,
  ch.company_id,
  ch.division_id,
  ch.gender,
  ch.date_of_birth,
  ch.category,
  ch.bunk_id,
  NULL,
  ch.person_id,
  ch.rfid,
  ch.photo_url,
  '2027',
  ch.session,
  ch.tshirt_size,
  ch.birthday_cake_type,
  ch.birthday_cake_meal,
  ch.birthday_cake_message,
  ch.birthday_cake_allergies,
  ch.birthday_frosting_colors,
  ch.birthday_toppings,
  ch.birthday_group,
  ch.birthday_party_type,
  ch.birthday_party_comments,
  0,
  now(),
  now()
FROM public.children ch
JOIN _child_roll r ON r.old_id = ch.id;

UPDATE public.children ch27
SET leader_id = lm.new_id,
    updated_at = now()
FROM _child_roll cm
JOIN public.children ch26 ON ch26.id = cm.old_id
JOIN _staff_roll sm ON sm.old_id = ch26.leader_id
JOIN _staff_roll lm ON lm.old_id = sm.old_id
WHERE ch27.id = cm.new_id
  AND ch26.leader_id IS NOT NULL;

-- ----- SUNSHINE REPORT (optional per company — skips if 2027 rows already exist) -----
CREATE TEMP TABLE _sunshine_group_roll ON COMMIT DROP AS
SELECT
  g.id AS old_id,
  gen_random_uuid() AS new_id,
  g.company_id
FROM public.sunshine_groups g
WHERE g.season = '2026'
  AND NOT EXISTS (
    SELECT 1
    FROM public.sunshine_groups g27
    WHERE g27.company_id = g.company_id
      AND g27.season = '2027'
  );

INSERT INTO public.sunshine_groups (id, company_id, name, sort_order, season, created_at)
SELECT
  r.new_id,
  g.company_id,
  g.name,
  g.sort_order,
  '2027',
  now()
FROM public.sunshine_groups g
JOIN _sunshine_group_roll r ON r.old_id = g.id;

CREATE TEMP TABLE _sunshine_camper_roll ON COMMIT DROP AS
SELECT
  sc.id AS old_id,
  gen_random_uuid() AS new_id,
  sc.company_id
FROM public.sunshine_campers sc
WHERE sc.season = '2026'
  AND NOT EXISTS (
    SELECT 1
    FROM public.sunshine_campers sc27
    WHERE sc27.company_id = sc.company_id
      AND sc27.season = '2027'
  );

INSERT INTO public.sunshine_campers (
  id,
  company_id,
  group_id,
  full_name,
  parent_email,
  sort_order,
  season,
  created_at
)
SELECT
  cr.new_id,
  sc.company_id,
  gr.new_id,
  sc.full_name,
  sc.parent_email,
  sc.sort_order,
  '2027',
  now()
FROM public.sunshine_campers sc
JOIN _sunshine_camper_roll cr ON cr.old_id = sc.id
LEFT JOIN _sunshine_group_roll gr ON gr.old_id = sc.group_id;

COMMIT;

-- =============================================================================
-- VERIFY
-- =============================================================================
SELECT
  c.slug,
  (SELECT COUNT(*) FROM public.children ch WHERE ch.company_id = c.id AND ch.season = '2026') AS children_2026,
  (SELECT COUNT(*) FROM public.children ch WHERE ch.company_id = c.id AND ch.season = '2027') AS children_2027,
  (SELECT COUNT(*) FROM public.staff s WHERE s.company_id = c.id AND s.season = '2026') AS staff_2026,
  (SELECT COUNT(*) FROM public.staff s WHERE s.company_id = c.id AND s.season = '2027') AS staff_2027
FROM public.companies c
WHERE c.slug IN (
  'tyler-hill-camp',
  'timber-lake-camp',
  'timber-lake-west',
  'north-shore-day-camp'
)
GROUP BY c.slug
ORDER BY c.slug;

SELECT
  c.slug,
  COUNT(*) FILTER (WHERE sg.season = '2026') AS sunshine_groups_2026,
  COUNT(*) FILTER (WHERE sg.season = '2027') AS sunshine_groups_2027,
  COUNT(*) FILTER (WHERE sc.season = '2026') AS sunshine_campers_2026,
  COUNT(*) FILTER (WHERE sc.season = '2027') AS sunshine_campers_2027
FROM public.companies c
LEFT JOIN public.sunshine_groups sg ON sg.company_id = c.id
LEFT JOIN public.sunshine_campers sc ON sc.company_id = c.id
WHERE c.slug = 'north-shore-day-camp'
GROUP BY c.slug;
