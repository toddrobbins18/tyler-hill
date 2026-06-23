-- =============================================================================
-- Division leader roster access — run in Supabase SQL Editor (safe to re-run).
-- Fixes Super Girls / Teen / alias drift for all division leaders, including
-- ffionmiddleton99@gmail.com (Super Girls).
--
-- Same logic as migration 20260623120000_fix_division_bucket_consistency.sql
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

CREATE OR REPLACE FUNCTION public.canonical_division_id_for_bucket(
  _company_id uuid,
  _norm text
)
RETURNS uuid
LANGUAGE sql
STABLE
AS $$
  SELECT d.id
  FROM public.divisions d
  WHERE d.company_id = _company_id
    AND d.is_active = true
    AND public.normalize_division_name_for_filter(d.name) = _norm
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
$$;

CREATE OR REPLACE FUNCTION public.repoint_company_bucket_to_canonical(
  _company_id uuid,
  _norm text
)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  canonical_id uuid;
BEGIN
  canonical_id := public.canonical_division_id_for_bucket(_company_id, _norm);
  IF canonical_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.children c
  SET division_id = canonical_id
  FROM public.divisions d
  WHERE c.division_id = d.id
    AND d.company_id = _company_id
    AND public.normalize_division_name_for_filter(d.name) = _norm
    AND c.division_id IS DISTINCT FROM canonical_id;

  UPDATE public.staff s
  SET division_id = canonical_id
  FROM public.divisions d
  WHERE s.division_id = d.id
    AND d.company_id = _company_id
    AND public.normalize_division_name_for_filter(d.name) = _norm
    AND s.division_id IS DISTINCT FROM canonical_id;

  DELETE FROM public.division_permissions dp_alias
  USING public.divisions d, public.division_permissions dp_canonical
  WHERE dp_alias.division_id = d.id
    AND d.company_id = _company_id
    AND public.normalize_division_name_for_filter(d.name) = _norm
    AND dp_alias.division_id <> canonical_id
    AND dp_canonical.user_id = dp_alias.user_id
    AND dp_canonical.division_id = canonical_id;

  UPDATE public.division_permissions dp
  SET division_id = canonical_id
  FROM public.divisions d
  WHERE dp.division_id = d.id
    AND d.company_id = _company_id
    AND public.normalize_division_name_for_filter(d.name) = _norm
    AND dp.division_id IS DISTINCT FROM canonical_id;
END;
$$;

DO $$
DECLARE
  bucket RECORD;
  norm text;
BEGIN
  FOREACH norm IN ARRAY ARRAY['teen boys', 'teen girls', 'super boys', 'super girls']
  LOOP
    FOR bucket IN
      SELECT d.company_id
      FROM public.divisions d
      WHERE public.normalize_division_name_for_filter(d.name) = norm
      GROUP BY d.company_id
    LOOP
      PERFORM public.repoint_company_bucket_to_canonical(bucket.company_id, norm);
    END LOOP;
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
    canonical_id := public.canonical_division_id_for_bucket(bucket.company_id, bucket.norm);
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

CREATE OR REPLACE FUNCTION public.sync_division_permissions_from_staff_for_user(_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.division_permissions (user_id, division_id, company_id, can_access)
  SELECT DISTINCT
    ur.user_id,
    d.id,
    d.company_id,
    true
  FROM public.user_roles ur
  JOIN public.profiles p ON p.id = ur.user_id
  JOIN public.staff s
    ON s.company_id = p.company_id
   AND lower(trim(COALESCE(s.email, ''))) = lower(trim(COALESCE(p.email, '')))
   AND s.division_id IS NOT NULL
   AND COALESCE(s.status, 'active') = 'active'
  JOIN public.divisions staff_div ON staff_div.id = s.division_id
  JOIN public.divisions d
    ON d.company_id = staff_div.company_id
   AND d.is_active = true
   AND public.normalize_division_name_for_filter(d.name)
     = public.normalize_division_name_for_filter(staff_div.name)
  WHERE ur.user_id = _user_id
    AND ur.role IN ('division_leader'::public.app_role, 'viewer'::public.app_role)
  ON CONFLICT (user_id, division_id)
  DO UPDATE SET
    can_access = true,
    company_id = EXCLUDED.company_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_division_permissions_from_staff_trigger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.division_id IS NOT DISTINCT FROM OLD.division_id THEN
    RETURN NEW;
  END IF;

  IF NEW.division_id IS NULL OR COALESCE(NEW.status, 'active') <> 'active' THEN
    RETURN NEW;
  END IF;

  IF NEW.email IS NULL OR trim(NEW.email) = '' THEN
    RETURN NEW;
  END IF;

  SELECT u.id
  INTO v_user_id
  FROM auth.users u
  WHERE lower(trim(u.email)) = lower(trim(NEW.email))
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    PERFORM public.sync_division_permissions_from_staff_for_user(v_user_id);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_division_permissions_from_staff ON public.staff;

CREATE TRIGGER trg_sync_division_permissions_from_staff
AFTER INSERT OR UPDATE OF division_id, email, status
ON public.staff
FOR EACH ROW
EXECUTE FUNCTION public.sync_division_permissions_from_staff_trigger();

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT ur.user_id
    FROM public.user_roles ur
    WHERE ur.role IN ('division_leader'::public.app_role, 'viewer'::public.app_role)
  LOOP
    PERFORM public.sync_division_permissions_from_staff_for_user(r.user_id);
  END LOOP;
END $$;

DELETE FROM public.division_permissions dp
USING public.profiles p
WHERE p.id = dp.user_id
  AND dp.company_id IS DISTINCT FROM p.company_id
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p.id
      AND ur.role IN ('division_leader'::public.app_role, 'viewer'::public.app_role)
  );

-- =============================================================================
-- Audit — where Super Girls campers live vs what ffion can see
-- =============================================================================

SELECT
  d.id AS division_id,
  d.name AS division_name,
  d.is_active,
  public.normalize_division_name_for_filter(d.name) AS normalized,
  count(ch.id) AS camper_count_2026
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
JOIN public.children ch
  ON ch.company_id = p.company_id
 AND ch.season = '2026'
 AND COALESCE(ch.status, 'active') <> 'inactive'
JOIN public.divisions d ON d.id = ch.division_id
WHERE lower(trim(u.email)) = 'ffionmiddleton99@gmail.com'
  AND public.normalize_division_name_for_filter(d.name) = 'super girls'
GROUP BY d.id, d.name, d.is_active
ORDER BY camper_count_2026 DESC;

SELECT
  u.email,
  p.company_id,
  co.name AS company_name,
  ur.role,
  s.role AS staff_role,
  staff_div.name AS staff_division_name,
  staff_div.id AS staff_division_id,
  staff_div.is_active AS staff_division_active,
  (
    SELECT string_agg(DISTINCT d.name, ', ' ORDER BY d.name)
    FROM public.division_permissions dp
    JOIN public.divisions d ON d.id = dp.division_id
    WHERE dp.user_id = u.id AND dp.can_access = true
  ) AS permitted_division_names,
  public.get_user_divisions(u.id) AS rls_division_ids,
  (
    SELECT count(*)
    FROM public.children ch
    WHERE ch.company_id = p.company_id
      AND ch.season = '2026'
      AND COALESCE(ch.status, 'active') <> 'inactive'
      AND ch.division_id = ANY(COALESCE(public.get_user_divisions(u.id), ARRAY[]::uuid[]))
  ) AS campers_visible_via_rls,
  (
    SELECT count(*)
    FROM public.children ch
    JOIN public.divisions d ON d.id = ch.division_id
    WHERE ch.company_id = p.company_id
      AND ch.season = '2026'
      AND COALESCE(ch.status, 'active') <> 'inactive'
      AND public.normalize_division_name_for_filter(d.name) = 'super girls'
  ) AS total_super_girls_campers_in_db
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.companies co ON co.id = p.company_id
LEFT JOIN public.user_roles ur ON ur.user_id = u.id AND ur.company_id = p.company_id
LEFT JOIN public.staff s
  ON s.company_id = p.company_id
 AND lower(trim(COALESCE(s.email, ''))) = lower(trim(u.email))
 AND COALESCE(s.status, 'active') = 'active'
LEFT JOIN public.divisions staff_div ON staff_div.id = s.division_id
WHERE lower(trim(u.email)) = 'ffionmiddleton99@gmail.com';

-- =============================================================================
-- C) Explicit Super Girls grant if staff email/division match still missed a row
-- =============================================================================

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
 AND public.normalize_division_name_for_filter(d.name) = 'super girls'
WHERE lower(trim(u.email)) = 'ffionmiddleton99@gmail.com'
ON CONFLICT (user_id, division_id)
DO UPDATE SET can_access = true, company_id = EXCLUDED.company_id;

-- Repoint ffion's staff row to canonical Super Girls (if on alias)
UPDATE public.staff s
SET division_id = public.canonical_division_id_for_bucket(s.company_id, 'super girls')
WHERE EXISTS (
  SELECT 1
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  JOIN public.divisions staff_div ON staff_div.id = s.division_id
  WHERE lower(trim(u.email)) = 'ffionmiddleton99@gmail.com'
    AND s.company_id = p.company_id
    AND lower(trim(COALESCE(s.email, ''))) = lower(trim(u.email))
    AND COALESCE(s.status, 'active') = 'active'
    AND public.normalize_division_name_for_filter(staff_div.name) = 'super girls'
)
AND public.canonical_division_id_for_bucket(s.company_id, 'super girls') IS NOT NULL
AND s.division_id IS DISTINCT FROM public.canonical_division_id_for_bucket(s.company_id, 'super girls');

-- =============================================================================
-- D) Global audit — any division leader with 0 visible campers but campers exist in their bucket
-- =============================================================================

WITH leaders AS (
  SELECT DISTINCT
    u.id AS user_id,
    u.email,
    p.company_id,
    public.normalize_division_name_for_filter(staff_div.name) AS staff_norm
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  JOIN public.user_roles ur ON ur.user_id = u.id AND ur.company_id = p.company_id
  JOIN public.staff s
    ON s.company_id = p.company_id
   AND lower(trim(COALESCE(s.email, ''))) = lower(trim(COALESCE(p.email, u.email)))
   AND s.division_id IS NOT NULL
   AND COALESCE(s.status, 'active') = 'active'
  JOIN public.divisions staff_div ON staff_div.id = s.division_id
  WHERE ur.role = 'division_leader'::public.app_role
    AND public.normalize_division_name_for_filter(staff_div.name) <> ''
)
SELECT
  l.email,
  l.staff_norm,
  (
    SELECT count(*)
    FROM public.children ch
    JOIN public.divisions d ON d.id = ch.division_id
    WHERE ch.company_id = l.company_id
      AND ch.season = '2026'
      AND COALESCE(ch.status, 'active') <> 'inactive'
      AND public.normalize_division_name_for_filter(d.name) = l.staff_norm
  ) AS campers_in_bucket,
  (
    SELECT count(*)
    FROM public.children ch
    WHERE ch.company_id = l.company_id
      AND ch.season = '2026'
      AND COALESCE(ch.status, 'active') <> 'inactive'
      AND ch.division_id = ANY(COALESCE(public.get_user_divisions(l.user_id), ARRAY[]::uuid[]))
  ) AS campers_visible_via_rls
FROM leaders l
WHERE (
  SELECT count(*)
  FROM public.children ch
  JOIN public.divisions d ON d.id = ch.division_id
  WHERE ch.company_id = l.company_id
    AND ch.season = '2026'
    AND COALESCE(ch.status, 'active') <> 'inactive'
    AND public.normalize_division_name_for_filter(d.name) = l.staff_norm
) > 0
ORDER BY l.email;
