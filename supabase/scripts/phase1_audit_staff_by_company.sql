-- PHASE 1: Staff missing / cross-camp audit
-- Run in Supabase SQL Editor. Read-only checks first.

-- 1) Active staff counts by company + season
SELECT
  c.name AS company,
  s.season,
  s.status,
  COUNT(*) AS staff_count
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE s.season = '2026'
GROUP BY c.name, s.season, s.status
ORDER BY c.name, s.status;

-- 2) Tyler Hill active staff total (what admin Staff page should fetch)
SELECT COUNT(*) AS tyler_hill_active_2026
FROM public.staff
WHERE company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND season = '2026'
  AND COALESCE(LOWER(status), 'active') NOT IN ('inactive');

-- 3) Timber Lake active staff total
SELECT COUNT(*) AS timber_lake_active_2026
FROM public.staff
WHERE company_id = '1d296ccf-31e1-4176-af57-50a4a4820f82'::uuid
  AND season = '2026'
  AND COALESCE(LOWER(status), 'active') NOT IN ('inactive');

-- 4) Lifeguards by company (did company_id move affect the wrong camp?)
SELECT c.name AS company, s.name, s.role, s.status
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE s.season = '2026'
  AND s.role ILIKE '%lifeguard%'
ORDER BY c.name, s.name;

-- 5) Sara Pitre staff record + current assignments
SELECT s.id, s.name, s.email, s.role, s.status, s.company_id, s.specialty_sports, s.leader_id
FROM public.staff s
WHERE s.season = '2026'
  AND s.company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND (s.email ILIKE '%sarepitre%' OR s.name ILIKE '%sarah pitre%');

-- 6) Who Sara currently sees via staff_leader_assignments
SELECT st.name, st.role, st.status
FROM public.staff_leader_assignments sla
JOIN public.staff leader ON leader.id = sla.leader_id
JOIN public.staff st ON st.id = sla.staff_id
WHERE leader.name ILIKE '%sarah pitre%'
  AND sla.season = '2026'
  AND sla.company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
ORDER BY st.name;

-- 7) Staff with leader_id pointing at Sara (direct reports)
SELECT st.name, st.role, st.status
FROM public.staff st
JOIN public.staff leader ON leader.id = st.leader_id
WHERE leader.name ILIKE '%sarah pitre%'
  AND st.season = '2026'
  AND st.company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
ORDER BY st.name;
