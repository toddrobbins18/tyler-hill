-- Fix Teen Boys campers not visible to division leaders.
-- Root cause: children.division_id still points at an alias row (e.g. "Teen TN1 Boys")
-- while get_user_divisions() only returned active division IDs — zero overlap.
--
-- This migration:
-- 1) Expands get_user_divisions() to include inactive alias IDs in the same bucket.
-- 2) Repoints all children in the teen boys bucket to the canonical active division.

CREATE OR REPLACE FUNCTION public.get_user_divisions(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH permitted AS (
    SELECT dp.division_id, d.company_id, d.name
    FROM public.division_permissions dp
    JOIN public.divisions d ON d.id = dp.division_id
    WHERE dp.user_id = _user_id
      AND dp.can_access = true
  ),
  normalized_targets AS (
    SELECT DISTINCT
      p.company_id,
      public.normalize_division_name_for_filter(p.name) AS norm
    FROM permitted p
    WHERE public.normalize_division_name_for_filter(p.name) <> ''
  )
  SELECT COALESCE(array_agg(DISTINCT d.id), ARRAY[]::uuid[])
  FROM public.divisions d
  JOIN normalized_targets nt
    ON d.company_id = nt.company_id
   AND public.normalize_division_name_for_filter(d.name) = nt.norm;
$$;

-- Repoint children to canonical active Teen Boys division per company.
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

-- Deactivate duplicate teen boys alias rows after children are repointed.
UPDATE public.divisions alias_d
SET is_active = false
FROM public.divisions canonical_d
WHERE alias_d.company_id = canonical_d.company_id
  AND alias_d.id <> canonical_d.id
  AND alias_d.is_active = true
  AND canonical_d.is_active = true
  AND public.normalize_division_name_for_filter(alias_d.name) = 'teen boys'
  AND public.normalize_division_name_for_filter(canonical_d.name) = 'teen boys'
  AND canonical_d.name = 'Teen Boys'
  AND alias_d.name <> 'Teen Boys'
  AND NOT EXISTS (
    SELECT 1 FROM public.children c WHERE c.division_id = alias_d.id
  );
