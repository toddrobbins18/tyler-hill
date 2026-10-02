-- Test plan: did CampMinder sync overwrite manual 2027 grade fixes?
-- Run BEFORE sync (save results), then AFTER sync, compare.

-- =============================================================================
-- A) BEFORE SYNC — snapshot spot-check grades (save this output)
-- =============================================================================
SELECT
  ch.person_id,
  ch.name,
  ch.grade,
  d.name AS division,
  ch.updated_at
FROM public.children ch
LEFT JOIN public.divisions d ON d.id = ch.division_id
JOIN public.companies co ON co.id = ch.company_id
WHERE co.slug = 'north-shore-day-camp'
  AND ch.season = '2027'
  AND ch.person_id IN (
    '9714577',   -- Sydney Wurst → expect 8th
    '13312484',  -- Cali Robbins → expect 3rd
    '15899187'   -- Andi Robbins → expect 1st
  )
ORDER BY ch.name;

-- Count mismatches vs Todd export (should be 0 before sync if fix ran)
-- (Uses same logic as verify_ns_2027_grades_vs_campminder.sql — run that file for full compare)

-- =============================================================================
-- B) MONITOR SYNC JOB (run while sync is in progress / after it finishes)
-- =============================================================================
SELECT
  j.id AS job_id,
  j.status,
  j.created_at,
  j.completed_at,
  j.progress->>'season' AS season,
  j.progress->>'syncType' AS sync_type,
  j.progress->>'step' AS last_step,
  j.progress->>'campers_updated' AS campers_updated,
  j.progress->>'total_changes' AS total_changes,
  j.error_message
FROM public.sync_jobs j
JOIN public.companies c ON c.id = j.company_id
WHERE j.entity_type = 'campminder'
  AND c.slug = 'north-shore-day-camp'
ORDER BY j.created_at DESC
LIMIT 3;

-- Grade changes logged by sync (first 50 in job payload)
SELECT
  j.id AS job_id,
  j.completed_at,
  elem->>'name' AS camper_name,
  elem->>'person_id' AS person_id,
  change->>'field' AS field,
  change->>'old_value' AS old_value,
  change->>'new_value' AS new_value
FROM public.sync_jobs j
JOIN public.companies c ON c.id = j.company_id
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(j.progress->'changes_summary', '[]'::jsonb)) AS elem
CROSS JOIN LATERAL jsonb_array_elements(COALESCE(elem->'changes', '[]'::jsonb)) AS change
WHERE j.entity_type = 'campminder'
  AND c.slug = 'north-shore-day-camp'
  AND j.status = 'completed'
  AND change->>'field' = 'grade'
ORDER BY j.completed_at DESC, camper_name
LIMIT 100;

-- =============================================================================
-- C) AFTER SYNC — same spot checks (compare to section A)
-- =============================================================================
SELECT
  ch.person_id,
  ch.name,
  ch.grade,
  d.name AS division,
  ch.updated_at
FROM public.children ch
LEFT JOIN public.divisions d ON d.id = ch.division_id
JOIN public.companies co ON co.id = ch.company_id
WHERE co.slug = 'north-shore-day-camp'
  AND ch.season = '2027'
  AND ch.person_id IN ('9714577', '13312484', '15899187')
ORDER BY ch.name;

-- =============================================================================
-- D) AFTER SYNC — full verify vs Todd export
-- Run: verify_ns_2027_grades_vs_campminder.sql
-- If grade_mismatches > 0, sync overwrote manual fixes → re-run fix_ns_2027_grades_from_todd.sql
-- =============================================================================
