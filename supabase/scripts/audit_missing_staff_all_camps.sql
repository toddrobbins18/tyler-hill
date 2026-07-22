-- Missing staff audit (all camps) — run in Supabase SQL Editor
-- Todd report: Tyler Hill + all camps missing people (2026-07-22)
--
-- Expected active staff (from sync code comments):
--   Tyler Hill ~290 | Timber Lake Camp ~230 | Timber Lake West ~180

-- =============================================================================
-- 1) HEADLINE: active vs inactive vs total by camp (2026)
-- =============================================================================

SELECT
  c.slug,
  c.name AS company,
  COUNT(*) FILTER (WHERE COALESCE(LOWER(s.status), 'active') NOT IN ('inactive')) AS active,
  COUNT(*) FILTER (WHERE LOWER(COALESCE(s.status, '')) = 'inactive') AS inactive,
  COUNT(*) AS total,
  COUNT(*) FILTER (WHERE s.person_id IS NULL OR TRIM(s.person_id) = '') AS missing_person_id
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE s.season = '2026'
  AND c.is_active = true
GROUP BY c.slug, c.name
ORDER BY c.name;

-- =============================================================================
-- 2) What the Staff PAGE shows (same filters as app)
-- =============================================================================

SELECT
  c.name AS company,
  COUNT(*) AS visible_on_staff_page
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE s.season = '2026'
  AND c.is_active = true
  AND COALESCE(LOWER(s.status), 'active') NOT IN ('inactive')
  AND s.name IS NOT NULL
  AND s.name <> 'Unknown'
GROUP BY c.name
ORDER BY c.name;

-- =============================================================================
-- 3) Recently marked inactive (last 7 days) — likely CampMinder sync cleanup
-- =============================================================================

SELECT
  c.name AS company,
  s.name,
  s.role,
  s.person_id,
  s.status,
  s.updated_at
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE s.season = '2026'
  AND LOWER(COALESCE(s.status, '')) = 'inactive'
  AND s.updated_at >= now() - interval '7 days'
ORDER BY s.updated_at DESC, c.name, s.name
LIMIT 200;

-- Count by day inactive updates
SELECT
  DATE(s.updated_at AT TIME ZONE 'America/New_York') AS inactive_date_et,
  c.name AS company,
  COUNT(*) AS staff_marked_inactive
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE s.season = '2026'
  AND LOWER(COALESCE(s.status, '')) = 'inactive'
  AND s.updated_at >= now() - interval '14 days'
GROUP BY 1, 2
ORDER BY 1 DESC, 2;

-- =============================================================================
-- 4) Cross-camp moves (same person_id on multiple companies) — lifeguard fix?
-- =============================================================================

SELECT
  s.person_id,
  STRING_AGG(DISTINCT c.name, ' | ' ORDER BY c.name) AS companies,
  STRING_AGG(s.name || ' (' || COALESCE(s.status, 'active') || ')', ', ' ORDER BY s.name) AS records
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE s.season = '2026'
  AND s.person_id IS NOT NULL
  AND TRIM(s.person_id) <> ''
GROUP BY s.person_id
HAVING COUNT(DISTINCT s.company_id) > 1
ORDER BY companies
LIMIT 100;

-- =============================================================================
-- 5) Lifeguards by company (company_id migration check)
-- =============================================================================

SELECT c.name AS company, s.name, s.role, s.status, s.updated_at
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE s.season = '2026'
  AND s.role ILIKE '%lifeguard%'
ORDER BY c.name, s.name;

-- =============================================================================
-- 6) Inactive WITH person_id (CampMinder should have them Active — investigate CM)
-- =============================================================================

SELECT
  c.name AS company,
  COUNT(*) AS inactive_with_person_id
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE s.season = '2026'
  AND LOWER(COALESCE(s.status, '')) = 'inactive'
  AND s.person_id IS NOT NULL
  AND TRIM(s.person_id) <> ''
GROUP BY c.name
ORDER BY c.name;

-- Sample: inactive staff who look like current counselors (not obvious alumni)
SELECT c.name AS company, s.name, s.role, s.person_id, s.updated_at
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE s.season = '2026'
  AND LOWER(COALESCE(s.status, '')) = 'inactive'
  AND s.role ILIKE ANY (ARRAY['%counselor%', '%lifeguard%', '%waterfront%', '%director%'])
ORDER BY s.updated_at DESC
LIMIT 50;

-- =============================================================================
-- 7) Recent CampMinder staff sync jobs
-- =============================================================================

SELECT
  id,
  entity_type,
  status,
  company_id,
  created_at,
  updated_at,
  completed_at,
  error_message,
  total_counts
FROM public.sync_jobs
WHERE entity_type ILIKE '%staff%' OR entity_type ILIKE '%full%'
ORDER BY created_at DESC
LIMIT 30;

-- =============================================================================
-- 8) Tyler Hill only: inactive count vs expected ~290 active
-- =============================================================================

SELECT
  COUNT(*) FILTER (WHERE COALESCE(LOWER(status), 'active') NOT IN ('inactive')) AS tyler_hill_active,
  COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) = 'inactive') AS tyler_hill_inactive,
  COUNT(*) AS tyler_hill_total
FROM public.staff
WHERE company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND season = '2026';

-- =============================================================================
-- INTERPRETATION
-- =============================================================================
-- • Staff page hides status = inactive (not deleted from DB).
-- • CampMinder staff sync marks anyone NOT on CM Active list as inactive.
-- • Our lifeguard fix moved ~14 lifeguards TLC → Tyler Hill (TLC count drops, TH rises).
-- • Sara team fix set 10 people back to active on Tyler Hill only.
-- • If inactive spiked on same date as sync_jobs staff run → sync caused it.
--
-- DO NOT bulk-reactivate without Todd unless CM confirms they are Active in CampMinder.
-- Re-run staff sync after fixing CM, or reactivate specific names Todd confirms.
