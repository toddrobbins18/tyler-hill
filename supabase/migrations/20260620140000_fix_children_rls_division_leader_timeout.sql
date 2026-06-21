-- Fix division_leader roster timeouts (57014 statement timeout).
-- 1) Repoint stale division_permissions off inactive alias divisions.
-- 2) Resolve permissions via normalized division names (not only active permission rows).
-- 3) Replace per-row person_id subquery in children RLS with a single precomputed array.

-- Repoint permissions that still reference deactivated alias divisions.
UPDATE public.division_permissions dp
SET division_id = active_d.id
FROM public.divisions inactive
JOIN public.divisions active_d
  ON active_d.company_id = inactive.company_id
 AND active_d.is_active = true
 AND public.normalize_division_name_for_filter(active_d.name)
   = public.normalize_division_name_for_filter(inactive.name)
WHERE dp.division_id = inactive.id
  AND inactive.is_active = false
  AND NOT EXISTS (
    SELECT 1
    FROM public.division_permissions existing
    WHERE existing.user_id = dp.user_id
      AND existing.division_id = active_d.id
  );

DELETE FROM public.division_permissions dp
USING public.divisions inactive
WHERE dp.division_id = inactive.id
  AND inactive.is_active = false;

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
   AND public.normalize_division_name_for_filter(d.name) = nt.norm
  WHERE d.is_active = true;
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

CREATE OR REPLACE FUNCTION public.user_can_access_child_person_id(_person_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.normalize_person_id_for_match(_person_id) = ANY(
    COALESCE(public.get_user_accessible_person_ids(auth.uid()), ARRAY[]::text[])
  );
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
              c.division_id = ANY(COALESCE(public.get_user_divisions(auth.uid()), ARRAY[]::uuid[]))
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
          division_id = ANY(COALESCE(public.get_user_divisions(auth.uid()), ARRAY[]::uuid[]))
          OR public.normalize_person_id_for_match(person_id) = ANY(
            COALESCE(public.get_user_accessible_person_ids(auth.uid()), ARRAY[]::text[])
          )
        )
      )
    )
  )
);

CREATE INDEX IF NOT EXISTS idx_children_company_division
  ON public.children(company_id, division_id);

CREATE INDEX IF NOT EXISTS idx_children_company_season_status
  ON public.children(company_id, season, status);
