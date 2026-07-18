-- Robust division_leader children access: match by normalized division name within user's company.
-- Collapses suffixes like "A", "B", "1", "2" so that division leaders for "Freshman A" 
-- can see "Freshman B" and "Freshman" (canonical) campers.

CREATE OR REPLACE FUNCTION public.normalize_division_name_for_filter(name text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT lower(trim(regexp_replace(
    regexp_replace(
      regexp_replace(
        regexp_replace(COALESCE(name, ''), '\mSuper\s+Senior\M', 'Super', 'gi'),
        '\mTN\d+\M', '', 'gi'
      ),
      '\s+[A-Z0-9]\M', '', 'g'
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

CREATE OR REPLACE FUNCTION public.get_user_accessible_person_ids(_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    array_agg(DISTINCT public.normalize_person_id_for_match(c.person_id))
      FILTER (WHERE public.normalize_person_id_for_match(c.person_id) IS NOT NULL),
    ARRAY[]::text[]
  )
  FROM public.children c
  WHERE c.company_id = public.get_user_company(_user_id)
    AND c.division_id = ANY(COALESCE(public.get_user_divisions(_user_id), ARRAY[]::uuid[]));
$$;

CREATE OR REPLACE FUNCTION public.can_access_child(_child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1
      FROM public.children c
      WHERE c.id = _child_id
        AND c.company_id = public.get_user_company(auth.uid())
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
              public.user_can_access_division_id(c.division_id)
              OR public.normalize_person_id_for_match(c.person_id) = ANY(
                COALESCE(public.get_user_accessible_person_ids(auth.uid()), ARRAY[]::text[])
              )
            )
          )
        )
    );
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

-- Ensure hardylilly has Teen Boys permission on Tyler Hill (idempotent).
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
 AND public.normalize_division_name_for_filter(d.name) = 'teen boys'
WHERE lower(trim(u.email)) = 'hardylilly234@gmail.com'
ON CONFLICT (user_id, division_id)
DO UPDATE SET can_access = true, company_id = EXCLUDED.company_id;

-- Remove division_permissions rows for other companies (prevents cross-camp UUID pollution).
DELETE FROM public.division_permissions dp
USING auth.users u
JOIN public.profiles p ON p.id = u.id
WHERE u.id = dp.user_id
  AND lower(trim(u.email)) = 'hardylilly234@gmail.com'
  AND dp.company_id IS DISTINCT FROM p.company_id;

-- Verify (run as postgres — uses get_user_divisions, not auth.uid()).
SELECT
  u.email,
  p.company_id,
  co.name AS company_name,
  public.get_user_divisions(u.id) AS allowed_division_ids,
  (
    SELECT count(*)
    FROM public.children ch
    JOIN public.divisions d ON d.id = ch.division_id
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
      AND public.normalize_division_name_for_filter(d.name) = 'teen boys'
  ) AS total_teen_boys_campers_in_db
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
JOIN public.companies co ON co.id = p.company_id
WHERE lower(trim(u.email)) = 'hardylilly234@gmail.com';
