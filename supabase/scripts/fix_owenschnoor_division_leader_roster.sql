-- Fix division_leader roster access for owenschnoor4@gmail.com
-- Run entire script in Supabase SQL Editor. Safe to re-run.

-- =============================================================================
-- A) Global fixes (idempotent — skip if already applied)
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

CREATE OR REPLACE FUNCTION public.user_can_access_division_id(_division_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _division_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.divisions child_div
      JOIN public.division_permissions dp
        ON dp.user_id = auth.uid()
       AND dp.can_access = true
       AND dp.company_id = public.get_user_company(auth.uid())
      JOIN public.divisions perm_div ON perm_div.id = dp.division_id
      WHERE child_div.id = _division_id
        AND child_div.company_id = public.get_user_company(auth.uid())
        AND perm_div.company_id = public.get_user_company(auth.uid())
        AND public.normalize_division_name_for_filter(child_div.name)
          = public.normalize_division_name_for_filter(perm_div.name)
        AND public.normalize_division_name_for_filter(child_div.name) <> ''
    );
$$;

CREATE OR REPLACE FUNCTION public.get_user_divisions(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH user_company AS (
    SELECT public.get_user_company(_user_id) AS company_id
  ),
  permitted AS (
    SELECT dp.division_id, d.company_id, d.name
    FROM public.division_permissions dp
    JOIN public.divisions d ON d.id = dp.division_id
    CROSS JOIN user_company uc
    WHERE dp.user_id = _user_id
      AND dp.can_access = true
      AND d.company_id = uc.company_id
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

DROP POLICY IF EXISTS "Users can view children from their company" ON public.children;

CREATE POLICY "Users can view children from their company"
ON public.children
FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR (
    company_id = public.get_user_company(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'staff'::app_role)
      OR public.has_role(auth.uid(), 'health_center'::app_role)
      OR public.has_role(auth.uid(), 'specialist'::app_role)
      OR (
        (
          public.has_role(auth.uid(), 'division_leader'::app_role)
          OR public.has_role(auth.uid(), 'viewer'::app_role)
        )
        AND (
          public.user_can_access_division_id(division_id)
          OR public.normalize_person_id_for_match(person_id) = ANY(
            COALESCE(public.get_user_accessible_person_ids(auth.uid()), ARRAY[]::text[])
          )
        )
      )
    )
  )
);

-- =============================================================================
-- B) Fix this user — permissions from staff + all alias divisions in same bucket
-- =============================================================================

-- Remove permissions tied to other camps
DELETE FROM public.division_permissions dp
USING auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE u.id = dp.user_id
  AND lower(trim(u.email)) = 'owenschnoor4@gmail.com'
  AND dp.company_id IS DISTINCT FROM p.company_id;

-- Grant every division in the same normalized bucket as their staff assignment
INSERT INTO public.division_permissions (user_id, division_id, company_id, can_access)
SELECT DISTINCT
  u.id,
  d.id,
  d.company_id,
  true
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
JOIN public.staff s
  ON s.company_id = p.company_id
 AND lower(trim(COALESCE(s.email, ''))) = lower(trim(u.email))
 AND s.division_id IS NOT NULL
 AND COALESCE(s.status, 'active') = 'active'
JOIN public.divisions staff_div ON staff_div.id = s.division_id
JOIN public.divisions d
  ON d.company_id = staff_div.company_id
 AND d.is_active = true
 AND public.normalize_division_name_for_filter(d.name)
   = public.normalize_division_name_for_filter(staff_div.name)
WHERE lower(trim(u.email)) = 'owenschnoor4@gmail.com'
ON CONFLICT (user_id, division_id)
DO UPDATE SET can_access = true, company_id = EXCLUDED.company_id;

-- Also grant Teen Boys bucket (covers Teen TN1 Boys alias)
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
WHERE lower(trim(u.email)) = 'owenschnoor4@gmail.com'
ON CONFLICT (user_id, division_id)
DO UPDATE SET can_access = true, company_id = EXCLUDED.company_id;

-- Repoint teen-boys campers to canonical "Teen Boys" row (this company only)
DO $$
DECLARE
  v_company_id uuid;
  canonical_id uuid;
BEGIN
  SELECT p.company_id INTO v_company_id
  FROM auth.users u
  JOIN public.profiles p ON p.id = u.id
  WHERE lower(trim(u.email)) = 'owenschnoor4@gmail.com'
  LIMIT 1;

  IF v_company_id IS NULL THEN
    RETURN;
  END IF;

  SELECT d.id INTO canonical_id
  FROM public.divisions d
  WHERE d.company_id = v_company_id
    AND d.is_active = true
    AND d.name = 'Teen Boys'
  LIMIT 1;

  IF canonical_id IS NULL THEN
    SELECT d.id INTO canonical_id
    FROM public.divisions d
    WHERE d.company_id = v_company_id
      AND d.is_active = true
      AND d.name ILIKE '%teen%'
      AND d.name ILIKE '%boy%'
    ORDER BY d.name
    LIMIT 1;
  END IF;

  IF canonical_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.children c
  SET division_id = canonical_id
  FROM public.divisions d
  WHERE c.division_id = d.id
    AND d.company_id = v_company_id
    AND d.name ILIKE '%teen%'
    AND d.name ILIKE '%boy%'
    AND c.division_id IS DISTINCT FROM canonical_id;
END $$;

-- =============================================================================
-- C) Verify
-- =============================================================================

SELECT
  u.email,
  p.company_id,
  co.name AS company_name,
  ur.role,
  public.get_user_divisions(u.id) AS rls_division_ids,
  (
    SELECT string_agg(DISTINCT d.name, ', ' ORDER BY d.name)
    FROM public.division_permissions dp
    JOIN public.divisions d ON d.id = dp.division_id
    WHERE dp.user_id = u.id AND dp.can_access = true
  ) AS permitted_division_names,
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
      AND d.name ILIKE '%teen%'
      AND d.name ILIKE '%boy%'
  ) AS teen_boys_campers_in_db
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.companies co ON co.id = p.company_id
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE lower(trim(u.email)) = 'owenschnoor4@gmail.com';
