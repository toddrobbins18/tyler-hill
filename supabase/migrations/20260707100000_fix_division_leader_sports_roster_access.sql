-- Division leaders could not view sports rosters / camper lists while admins (e.g. Scott) could.
-- Causes: children RLS omitted division_leader from company role check; division_permissions
-- sync keyed off profiles.company_id instead of user_roles.company_id; roster members with
-- missing/wrong division_id invisible to DLs on read-only sports rosters.

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
  JOIN auth.users u ON u.id = ur.user_id
  JOIN public.staff s
    ON s.company_id = COALESCE(ur.company_id, p.company_id)
   AND lower(trim(COALESCE(s.email, ''))) = lower(trim(COALESCE(p.email, u.email)))
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
      AND dp.company_id = d.company_id
      AND (
        d.company_id = public.get_user_company(_user_id)
        OR public.user_has_role_for_company(
          _user_id,
          d.company_id,
          ARRAY['division_leader', 'viewer']::public.app_role[]
        )
      )
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
      JOIN public.divisions perm_div ON perm_div.id = dp.division_id
      WHERE child_div.id = _division_id
        AND child_div.company_id = perm_div.company_id
        AND dp.company_id = perm_div.company_id
        AND (
          perm_div.company_id = public.get_user_company(auth.uid())
          OR public.user_has_role_for_company(
            auth.uid(),
            perm_div.company_id,
            ARRAY['division_leader', 'viewer']::public.app_role[]
          )
        )
        AND public.normalize_division_name_for_filter(child_div.name)
          = public.normalize_division_name_for_filter(perm_div.name)
        AND public.normalize_division_name_for_filter(child_div.name) <> ''
    );
$$;

CREATE OR REPLACE FUNCTION public.sports_event_accessible_to_user_divisions(
  _event_id uuid,
  _user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sports_calendar sc
    WHERE sc.id = _event_id
      AND (
        (
          sc.division_id IS NULL
          AND NOT EXISTS (
            SELECT 1
            FROM public.sports_calendar_divisions scd
            WHERE scd.sports_event_id = sc.id
          )
        )
        OR sc.division_id = ANY(COALESCE(public.get_user_divisions(_user_id), ARRAY[]::uuid[]))
        OR EXISTS (
          SELECT 1
          FROM public.sports_calendar_divisions scd
          WHERE scd.sports_event_id = sc.id
            AND scd.division_id = ANY(COALESCE(public.get_user_divisions(_user_id), ARRAY[]::uuid[]))
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_view_child_on_accessible_sports_roster(_child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.sports_event_roster ser
    JOIN public.sports_calendar sc ON sc.id = ser.event_id
    WHERE ser.child_id = _child_id
      AND (
        public.user_has_role_for_company(
          auth.uid(),
          sc.company_id,
          ARRAY['admin', 'staff', 'specialist', 'health_center']::public.app_role[]
        )
        OR (
          public.user_has_role_for_company(
            auth.uid(),
            sc.company_id,
            ARRAY['division_leader', 'viewer']::public.app_role[]
          )
          AND public.sports_event_accessible_to_user_divisions(sc.id, auth.uid())
        )
      )
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
        AND (
          c.company_id = public.get_user_company(auth.uid())
          OR public.user_has_role_for_company(
            auth.uid(),
            c.company_id,
            ARRAY[
              'admin',
              'staff',
              'health_center',
              'specialist',
              'division_leader',
              'viewer'
            ]::public.app_role[]
          )
        )
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
              OR public.user_can_view_child_on_accessible_sports_roster(c.id)
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
    (
      company_id = public.get_user_company(auth.uid())
      OR public.user_has_role_for_company(
        auth.uid(),
        company_id,
        ARRAY[
          'admin',
          'staff',
          'health_center',
          'specialist',
          'division_leader',
          'viewer'
        ]::public.app_role[]
      )
    )
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
          OR public.user_can_view_child_on_accessible_sports_roster(id)
        )
      )
    )
  )
);

-- Backfill division_permissions from staff rows for every division leader / viewer.
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
