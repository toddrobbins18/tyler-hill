-- Fix normalize_division_name_for_filter: collapse whitespace after stripping TN1/Super Senior.
-- Without this, "Teen TN1 Boys" normalizes to 'teen  boys' but "Teen Boys" is 'teen boys',
-- so get_user_divisions() never expands alias divisions and division leaders see 0 campers.

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

-- Repoint teen boys campers to canonical active division (idempotent).
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

-- Merge duplicate teen boys / teen girls alias rows (do NOT rename — unique constraint on company_id+name).
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

-- If only a TN1 alias exists (no canonical row yet), rename it safely.
UPDATE public.divisions alias_d
SET name = CASE bucket.norm
  WHEN 'teen boys' THEN 'Teen Boys'
  WHEN 'teen girls' THEN 'Teen Girls'
  WHEN 'super boys' THEN 'Super Boys'
  WHEN 'super girls' THEN 'Super Girls'
  ELSE alias_d.name
END
FROM (
  SELECT d.company_id, public.normalize_division_name_for_filter(d.name) AS norm
  FROM public.divisions d
  WHERE d.is_active = true
    AND public.normalize_division_name_for_filter(d.name) IN ('teen boys', 'teen girls', 'super girls', 'super boys')
  GROUP BY d.company_id, public.normalize_division_name_for_filter(d.name)
  HAVING count(*) = 1
) bucket
WHERE alias_d.company_id = bucket.company_id
  AND public.normalize_division_name_for_filter(alias_d.name) = bucket.norm
  AND alias_d.is_active = true
  AND alias_d.name ~* 'TN\d+|Super\s+Senior';

