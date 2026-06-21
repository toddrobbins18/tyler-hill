-- Safe re-run of 20260620170000 if rename failed with divisions_company_name_unique.
-- Run entire script in Supabase SQL Editor.

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

DO $$
DECLARE
  bucket RECORD;
  canonical_id uuid;
BEGIN
  FOR bucket IN
    SELECT d.company_id
    FROM public.divisions d
    WHERE public.normalize_division_name_for_filter(d.name) = 'teen boys'
    GROUP BY d.company_id
  LOOP
    SELECT d.id
    INTO canonical_id
    FROM public.divisions d
    WHERE d.company_id = bucket.company_id
      AND d.is_active = true
      AND public.normalize_division_name_for_filter(d.name) = 'teen boys'
    ORDER BY
      CASE d.name WHEN 'Teen Boys' THEN 1 ELSE 2 END,
      d.sort_order,
      d.created_at
    LIMIT 1;

    IF canonical_id IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE public.children c
    SET division_id = canonical_id
    FROM public.divisions d
    WHERE c.division_id = d.id
      AND d.company_id = bucket.company_id
      AND public.normalize_division_name_for_filter(d.name) = 'teen boys'
      AND c.division_id IS DISTINCT FROM canonical_id;
  END LOOP;
END $$;

DO $$
DECLARE
  bucket RECORD;
  canonical_id uuid;
  alias_id uuid;
BEGIN
  FOR bucket IN
    SELECT d.company_id, public.normalize_division_name_for_filter(d.name) AS norm
    FROM public.divisions d
    WHERE public.normalize_division_name_for_filter(d.name) IN ('teen boys', 'teen girls', 'super girls', 'super boys')
    GROUP BY d.company_id, public.normalize_division_name_for_filter(d.name)
    HAVING count(*) > 1
  LOOP
    SELECT d.id
    INTO canonical_id
    FROM public.divisions d
    WHERE d.company_id = bucket.company_id
      AND d.is_active = true
      AND public.normalize_division_name_for_filter(d.name) = bucket.norm
    ORDER BY
      CASE d.name
        WHEN 'Teen Boys' THEN 1
        WHEN 'Teen Girls' THEN 1
        WHEN 'Super Boys' THEN 1
        WHEN 'Super Girls' THEN 1
        ELSE 2
      END,
      CASE WHEN d.name ~* 'Senior|TN\d+' THEN 2 ELSE 1 END,
      d.sort_order,
      d.created_at
    LIMIT 1;

    IF canonical_id IS NULL THEN
      CONTINUE;
    END IF;

    FOR alias_id IN
      SELECT d.id
      FROM public.divisions d
      WHERE d.company_id = bucket.company_id
        AND public.normalize_division_name_for_filter(d.name) = bucket.norm
        AND d.id <> canonical_id
    LOOP
      PERFORM public.repoint_division_id_refs(alias_id, canonical_id);
      UPDATE public.divisions SET is_active = false WHERE id = alias_id;
    END LOOP;
  END LOOP;
END $$;

-- Verify
SELECT
  public.normalize_division_name_for_filter('Teen Boys') AS teen_boys,
  public.normalize_division_name_for_filter('Teen TN1 Boys') AS teen_tn1_boys;

WITH target AS (
  SELECT u.id AS user_id, p.company_id
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  WHERE lower(trim(u.email)) = 'hardylilly234@gmail.com'
  LIMIT 1
)
SELECT count(*) AS teen_boys_campers_visible_via_rls
FROM public.children c, target t
WHERE c.company_id = t.company_id
  AND c.season = '2026'
  AND COALESCE(c.status, 'active') <> 'inactive'
  AND c.division_id = ANY(COALESCE(public.get_user_divisions(t.user_id), ARRAY[]::uuid[]));
