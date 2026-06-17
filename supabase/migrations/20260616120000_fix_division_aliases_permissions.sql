-- Fix Tyler Hill division alias drift (Super Senior / Teen TN1 vs Super / Teen).
-- Merges duplicate division rows, renames aliases, and expands get_user_divisions() for RLS.

CREATE OR REPLACE FUNCTION public.normalize_division_name_for_filter(name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(regexp_replace(
    regexp_replace(COALESCE(name, ''), '\mSuper\s+Senior\M', 'Super', 'gi'),
    '\mTN\d+\M', '', 'gi'
  )));
$$;

-- Repoint division_id FKs from alias rows to the canonical division in each bucket.
CREATE OR REPLACE FUNCTION public.repoint_division_id_refs(
  _alias_id uuid,
  _canonical_id uuid
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.children SET division_id = _canonical_id WHERE division_id = _alias_id;
  UPDATE public.master_calendar SET division_id = _canonical_id WHERE division_id = _alias_id;
  UPDATE public.sports_calendar SET division_id = _canonical_id WHERE division_id = _alias_id;
  UPDATE public.bunks SET division_id = _canonical_id WHERE division_id = _alias_id;
  UPDATE public.division_schedules SET division_id = _canonical_id WHERE division_id = _alias_id;
  UPDATE public.activities_field_trips SET division_id = _canonical_id WHERE division_id = _alias_id;

  UPDATE public.activities_field_trips_divisions
  SET division_id = _canonical_id
  WHERE division_id = _alias_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.activities_field_trips_divisions existing
      WHERE existing.activity_id = activities_field_trips_divisions.activity_id
        AND existing.division_id = _canonical_id
    );
  DELETE FROM public.activities_field_trips_divisions WHERE division_id = _alias_id;

  UPDATE public.special_events_divisions
  SET division_id = _canonical_id
  WHERE division_id = _alias_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.special_events_divisions existing
      WHERE existing.event_id = special_events_divisions.event_id
        AND existing.division_id = _canonical_id
    );
  DELETE FROM public.special_events_divisions WHERE division_id = _alias_id;

  UPDATE public.sports_calendar_divisions
  SET division_id = _canonical_id
  WHERE division_id = _alias_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.sports_calendar_divisions existing
      WHERE existing.sports_event_id = sports_calendar_divisions.sports_event_id
        AND existing.division_id = _canonical_id
    );
  DELETE FROM public.sports_calendar_divisions WHERE division_id = _alias_id;

  UPDATE public.staff SET division_id = _canonical_id WHERE division_id = _alias_id;

  UPDATE public.menu_items
  SET division_ids = (
    SELECT ARRAY(
      SELECT DISTINCT CASE WHEN x = _alias_id THEN _canonical_id ELSE x END
      FROM unnest(COALESCE(division_ids, ARRAY[]::uuid[])) AS x
    )
  )
  WHERE division_ids IS NOT NULL
    AND _alias_id = ANY(division_ids);

  INSERT INTO public.division_permissions (user_id, division_id, can_access, company_id)
  SELECT dp.user_id, _canonical_id, true, dp.company_id
  FROM public.division_permissions dp
  WHERE dp.division_id = _alias_id
    AND dp.can_access = true
  ON CONFLICT (user_id, division_id) DO UPDATE
    SET can_access = true;

  DELETE FROM public.division_permissions WHERE division_id = _alias_id;
END;
$$;

DO $$
DECLARE
  bucket RECORD;
  canonical_id uuid;
  alias_id uuid;
BEGIN
  FOR bucket IN
    SELECT d.company_id, public.normalize_division_name_for_filter(d.name) AS norm
    FROM public.divisions d
    WHERE d.is_active = true
      AND public.normalize_division_name_for_filter(d.name) <> ''
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
        WHEN 'Super Girls' THEN 1
        WHEN 'Super Boys' THEN 1
        WHEN 'Teen Girls' THEN 1
        WHEN 'Teen Boys' THEN 1
        ELSE 2
      END,
      CASE WHEN d.name ~* 'Senior|TN\d+' THEN 2 ELSE 1 END,
      d.sort_order,
      d.created_at
    LIMIT 1;

    FOR alias_id IN
      SELECT d.id
      FROM public.divisions d
      WHERE d.company_id = bucket.company_id
        AND d.is_active = true
        AND public.normalize_division_name_for_filter(d.name) = bucket.norm
        AND d.id <> canonical_id
    LOOP
      PERFORM public.repoint_division_id_refs(alias_id, canonical_id);
      UPDATE public.divisions SET is_active = false WHERE id = alias_id;
    END LOOP;
  END LOOP;
END $$;

-- Rename remaining alias-only rows to canonical display names.
UPDATE public.divisions
SET name = 'Super Girls'
WHERE is_active = true
  AND name = 'Super Senior Girls';

UPDATE public.divisions
SET name = 'Super Boys'
WHERE is_active = true
  AND name = 'Super Senior Boys';

UPDATE public.divisions
SET name = 'Teen Girls'
WHERE is_active = true
  AND name ~* '^Teen\s+TN\d+\s+Girls$';

UPDATE public.divisions
SET name = 'Teen Boys'
WHERE is_active = true
  AND name ~* '^Teen\s+TN\d+\s+Boys$';

-- Expand permitted division IDs to all aliases in the same normalized bucket (RLS parity with roster).
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
      AND d.is_active = true
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
   AND public.normalize_division_name_for_filter(d.name) = nt.norm
  WHERE d.is_active = true;
$$;
