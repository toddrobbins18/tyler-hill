-- Tyler Hill: Todd says 344 hired/active in CampMinder vs 235 active in Nest
-- company_id: 0d0b7f4f-327e-4497-83ff-3aa501ffc295
-- season: 2026
--
-- Gap: 344 - 235 = 109 staff likely marked inactive by sync but still hired in CM

-- Current state
SELECT
  COUNT(*) FILTER (WHERE COALESCE(LOWER(status), 'active') NOT IN ('inactive')) AS nest_active,
  COUNT(*) FILTER (WHERE LOWER(COALESCE(status, '')) = 'inactive') AS nest_inactive,
  COUNT(*) AS nest_total,
  344 AS todd_expected_active,
  344 - COUNT(*) FILTER (WHERE COALESCE(LOWER(status), 'active') NOT IN ('inactive')) AS gap_to_todd
FROM public.staff
WHERE company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND season = '2026';

-- Inactive WITH person_id (sync could re-activate these on next CM staff sync)
SELECT COUNT(*) AS inactive_with_person_id
FROM public.staff
WHERE company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND season = '2026'
  AND LOWER(COALESCE(status, '')) = 'inactive'
  AND person_id IS NOT NULL
  AND TRIM(person_id) <> '';

-- Inactive WITHOUT person_id (manual/import rows — sync will never auto-fix)
SELECT COUNT(*) AS inactive_no_person_id
FROM public.staff
WHERE company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND season = '2026'
  AND LOWER(COALESCE(status, '')) = 'inactive'
  AND (person_id IS NULL OR TRIM(person_id) = '');

-- Sample inactive counselors (Todd may recognize names that should be active)
SELECT name, role, person_id, updated_at
FROM public.staff
WHERE company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND season = '2026'
  AND LOWER(COALESCE(status, '')) = 'inactive'
ORDER BY updated_at DESC
LIMIT 50;

-- =============================================================================
-- FIX OPTION A (preferred): Re-run CampMinder STAFF sync for Tyler Hill only
-- Edge function / admin — pulls CM Active list and sets matching rows active.
-- =============================================================================

-- =============================================================================
-- FIX OPTION B: Bulk reactivate ALL inactive Tyler Hill 2026 (Todd confirmed 344)
-- Only run if Todd confirms inactive = wrongly hidden, not alumni/quit.
-- =============================================================================
/*
UPDATE public.staff
SET status = 'active', updated_at = now()
WHERE company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND season = '2026'
  AND LOWER(COALESCE(status, '')) = 'inactive';
*/

-- After Option B, active count should be ~397 (all rows), not 344.
-- So Option B over-corrects unless only ~109 of 162 should be active.
-- Prefer Option A (sync) or reactivate only person_id rows:

/*
UPDATE public.staff
SET status = 'active', updated_at = now()
WHERE company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND season = '2026'
  AND LOWER(COALESCE(status, '')) = 'inactive'
  AND person_id IS NOT NULL
  AND TRIM(person_id) <> '';
*/

-- Verify after fix
SELECT
  COUNT(*) FILTER (WHERE COALESCE(LOWER(status), 'active') NOT IN ('inactive')) AS active_after
FROM public.staff
WHERE company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND season = '2026';
