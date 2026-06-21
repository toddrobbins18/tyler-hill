-- =============================================================================
-- STEP 1: Find where Teen Boys campers actually live (run this first)
-- =============================================================================

SELECT
  d.id AS division_id,
  d.name AS division_name,
  d.is_active,
  public.normalize_division_name_for_filter(d.name) AS sql_normalized,
  count(ch.id) AS camper_count_2026
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
JOIN public.children ch
  ON ch.company_id = p.company_id
 AND ch.season = '2026'
 AND COALESCE(ch.status, 'active') <> 'inactive'
JOIN public.divisions d ON d.id = ch.division_id
WHERE lower(trim(u.email)) = 'hardylilly234@gmail.com'
  AND d.name ILIKE '%teen%boy%'
GROUP BY d.id, d.name, d.is_active
ORDER BY camper_count_2026 DESC;

-- =============================================================================
-- STEP 2: Compare Lilly's allowed divisions vs where campers are
-- =============================================================================

SELECT
  d.name AS division_name,
  d.id AS division_id,
  d.id = ANY(COALESCE(public.get_user_divisions(u.id), ARRAY[]::uuid[])) AS allowed_by_rls,
  count(ch.id) AS camper_count_2026
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
JOIN public.children ch
  ON ch.company_id = p.company_id
 AND ch.season = '2026'
 AND COALESCE(ch.status, 'active') <> 'inactive'
JOIN public.divisions d ON d.id = ch.division_id
WHERE lower(trim(u.email)) = 'hardylilly234@gmail.com'
GROUP BY u.id, d.id, d.name
HAVING count(ch.id) > 0
ORDER BY camper_count_2026 DESC;

-- =============================================================================
-- STEP 3: FIX — normalize function + grant Teen Boys access + repoint campers
-- Run after reviewing steps 1–2
-- =============================================================================

CREATE OR REPLACE FUNCTION public.normalize_division_name_for_filter(name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(regexp_replace(
    regexp_replace(
      regexp_replace(COALESCE(name, ''), '\mSuper\s+Senior\M', 'Super', 'gi'),
      '\mTN\d+\M', '', 'gi'
    ),
    '\s+', ' ', 'g'
  )));
$$;

-- Grant permission on EVERY division that has "teen" + "boy" in the name (Tyler Hill)
INSERT INTO public.division_permissions (user_id, division_id, company_id, can_access)
SELECT
  u.id,
  d.id,
  d.company_id,
  true
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
JOIN public.divisions d
  ON d.company_id = p.company_id
 AND d.is_active = true
 AND d.name ILIKE '%teen%'
 AND d.name ILIKE '%boy%'
WHERE lower(trim(u.email)) = 'hardylilly234@gmail.com'
ON CONFLICT (user_id, division_id)
DO UPDATE SET can_access = true, company_id = EXCLUDED.company_id;

-- Repoint all teen-boys-pattern campers to one canonical "Teen Boys" row per company
DO $$
DECLARE
  bucket RECORD;
  canonical_id uuid;
BEGIN
  FOR bucket IN
    SELECT p.company_id
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE lower(trim(u.email)) = 'hardylilly234@gmail.com'
  LOOP
    SELECT d.id INTO canonical_id
    FROM public.divisions d
    WHERE d.company_id = bucket.company_id
      AND d.is_active = true
      AND d.name = 'Teen Boys'
    LIMIT 1;

    IF canonical_id IS NULL THEN
      SELECT d.id INTO canonical_id
      FROM public.divisions d
      WHERE d.company_id = bucket.company_id
        AND d.is_active = true
        AND d.name ILIKE '%teen%'
        AND d.name ILIKE '%boy%'
      ORDER BY d.name
      LIMIT 1;
    END IF;

    IF canonical_id IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE public.children c
    SET division_id = canonical_id
    FROM public.divisions d
    WHERE c.division_id = d.id
      AND d.company_id = bucket.company_id
      AND d.name ILIKE '%teen%'
      AND d.name ILIKE '%boy%'
      AND c.division_id IS DISTINCT FROM canonical_id;
  END LOOP;
END $$;

-- =============================================================================
-- STEP 4: Verify after fix
-- =============================================================================

SELECT
  u.email,
  (
    SELECT count(*)
    FROM public.children ch
    JOIN public.divisions d ON d.id = ch.division_id
    JOIN public.profiles p ON p.id = u.id
    WHERE ch.company_id = p.company_id
      AND ch.season = '2026'
      AND COALESCE(ch.status, 'active') <> 'inactive'
      AND d.name ILIKE '%teen%'
      AND d.name ILIKE '%boy%'
  ) AS teen_boys_campers_in_db,
  (
    SELECT count(*)
    FROM public.children ch
    JOIN public.profiles p ON p.id = u.id
    WHERE ch.company_id = p.company_id
      AND ch.season = '2026'
      AND COALESCE(ch.status, 'active') <> 'inactive'
      AND ch.division_id = ANY(COALESCE(public.get_user_divisions(u.id), ARRAY[]::uuid[]))
  ) AS campers_visible_via_rls
FROM auth.users u
WHERE lower(trim(u.email)) = 'hardylilly234@gmail.com';
