-- =============================================================================
-- ONE-SHOT FIX: Roster Templates + Incident Reports RLS (web + mobile app)
-- Run the entire script in Supabase → SQL Editor. Safe to re-run.
--
-- Fixes:
--   • "new row violates row-level security policy for table roster_templates"
--   • "new row violates row-level security policy for table incident_reports"
--
-- Works for Timber Lake, Tyler Hill, multi-camp admins, division leaders,
-- specialists, staff, admin, and health_center roles.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Shared helpers (company-scoped roles via user_roles.company_id)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_has_role_for_company(
  _user_id uuid,
  _company_id uuid,
  _roles app_role[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id)
    OR EXISTS (
      SELECT 1
      FROM public.user_roles ur
      WHERE ur.user_id = _user_id
        AND ur.company_id = _company_id
        AND ur.role = ANY(_roles)
    );
$$;

-- ---------------------------------------------------------------------------
-- PART 1: Roster templates + athletics rosters (Timber Lake roster templates)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_can_manage_athletics_data(
  _user_id uuid,
  _company_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_role_for_company(
    _user_id,
    _company_id,
    ARRAY['admin', 'staff', 'specialist', 'division_leader']::public.app_role[]
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_view_athletics_company_data(
  _user_id uuid,
  _company_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id)
    OR public.user_has_role_for_company(
      _user_id,
      _company_id,
      ARRAY[
        'admin',
        'staff',
        'specialist',
        'division_leader',
        'viewer',
        'health_center'
      ]::public.app_role[]
    )
    OR _company_id = public.get_user_company(_user_id);
$$;

CREATE OR REPLACE FUNCTION public.can_manage_athletics_data(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.is_super_admin(_user_id)
    OR public.has_role(_user_id, 'admin'::public.app_role)
    OR public.has_role(_user_id, 'staff'::public.app_role)
    OR public.has_role(_user_id, 'specialist'::public.app_role)
    OR public.has_role(_user_id, 'division_leader'::public.app_role);
$$;

-- roster_templates
DROP POLICY IF EXISTS "Users can view roster templates from their company" ON public.roster_templates;
DROP POLICY IF EXISTS "Athletics staff can manage roster templates for their company" ON public.roster_templates;
DROP POLICY IF EXISTS "Admins can manage roster templates for their company" ON public.roster_templates;
DROP POLICY IF EXISTS "Admins and staff can manage roster templates" ON public.roster_templates;
DROP POLICY IF EXISTS "Everyone can view roster templates" ON public.roster_templates;

CREATE POLICY "Users can view roster templates from their company"
ON public.roster_templates
FOR SELECT
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.user_can_view_athletics_company_data(auth.uid(), company_id)
);

CREATE POLICY "Athletics staff can manage roster templates for their company"
ON public.roster_templates
FOR ALL
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.user_can_manage_athletics_data(auth.uid(), company_id)
)
WITH CHECK (
  company_id IS NOT NULL
  AND public.user_can_manage_athletics_data(auth.uid(), company_id)
);

-- roster_template_children
DROP POLICY IF EXISTS "Users can view roster template children from their company" ON public.roster_template_children;
DROP POLICY IF EXISTS "Athletics staff can manage roster template children for their company" ON public.roster_template_children;
DROP POLICY IF EXISTS "Admins can manage roster template children for their company" ON public.roster_template_children;
DROP POLICY IF EXISTS "Admins and staff can manage roster template children" ON public.roster_template_children;
DROP POLICY IF EXISTS "Everyone can view roster template children" ON public.roster_template_children;

CREATE POLICY "Users can view roster template children from their company"
ON public.roster_template_children
FOR SELECT
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.user_can_view_athletics_company_data(auth.uid(), company_id)
);

CREATE POLICY "Athletics staff can manage roster template children for their company"
ON public.roster_template_children
FOR ALL
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.user_can_manage_athletics_data(auth.uid(), company_id)
)
WITH CHECK (
  company_id IS NOT NULL
  AND public.user_can_manage_athletics_data(auth.uid(), company_id)
);

-- sports_event_roster
DROP POLICY IF EXISTS "Users can view sports rosters from their company" ON public.sports_event_roster;
DROP POLICY IF EXISTS "Athletics staff can manage sports rosters for their company" ON public.sports_event_roster;
DROP POLICY IF EXISTS "Admins can manage sports rosters for their company" ON public.sports_event_roster;
DROP POLICY IF EXISTS "Admins and staff can manage sports event rosters" ON public.sports_event_roster;
DROP POLICY IF EXISTS "Admins and staff can view sports event rosters" ON public.sports_event_roster;
DROP POLICY IF EXISTS "Users can view sports event roster from their company" ON public.sports_event_roster;

CREATE POLICY "Users can view sports rosters from their company"
ON public.sports_event_roster
FOR SELECT
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.user_can_view_athletics_company_data(auth.uid(), company_id)
);

CREATE POLICY "Athletics staff can manage sports rosters for their company"
ON public.sports_event_roster
FOR ALL
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.user_can_manage_athletics_data(auth.uid(), company_id)
)
WITH CHECK (
  company_id IS NOT NULL
  AND public.user_can_manage_athletics_data(auth.uid(), company_id)
);

-- sports_event_staff
DROP POLICY IF EXISTS "Users can view sports event staff from their company" ON public.sports_event_staff;
DROP POLICY IF EXISTS "Athletics staff can manage sports event staff for their company" ON public.sports_event_staff;
DROP POLICY IF EXISTS "Admins can manage sports event staff for their company" ON public.sports_event_staff;
DROP POLICY IF EXISTS "Admins and staff can manage sports event staff" ON public.sports_event_staff;
DROP POLICY IF EXISTS "Everyone can view sports event staff" ON public.sports_event_staff;

CREATE POLICY "Users can view sports event staff from their company"
ON public.sports_event_staff
FOR SELECT
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.user_can_view_athletics_company_data(auth.uid(), company_id)
);

CREATE POLICY "Athletics staff can manage sports event staff for their company"
ON public.sports_event_staff
FOR ALL
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.user_can_manage_athletics_data(auth.uid(), company_id)
)
WITH CHECK (
  company_id IS NOT NULL
  AND public.user_can_manage_athletics_data(auth.uid(), company_id)
);

-- ---------------------------------------------------------------------------
-- PART 2: Incident reports (mobile app + web)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.user_can_manage_incidents(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_role_for_company(
    _user_id,
    _company_id,
    ARRAY['admin', 'staff', 'health_center']::app_role[]
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_create_incident_reports(
  _user_id uuid,
  _company_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_role_for_company(
    _user_id,
    _company_id,
    ARRAY['admin', 'staff', 'health_center', 'division_leader', 'specialist']::public.app_role[]
  );
$$;

CREATE OR REPLACE FUNCTION public.incident_has_accessible_child(_incident_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.incident_children ic
    WHERE ic.incident_id = _incident_id
      AND public.can_access_child(ic.child_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_manage_incident_children(_incident_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.incident_reports ir
    WHERE ir.id = _incident_id
      AND ir.company_id IS NOT NULL
      AND public.user_can_manage_incidents(auth.uid(), ir.company_id)
  );
$$;

CREATE OR REPLACE FUNCTION public.can_view_incident_children(_incident_id uuid, _child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.incident_reports ir
    WHERE ir.id = _incident_id
      AND ir.company_id IS NOT NULL
      AND (
        public.user_can_manage_incidents(auth.uid(), ir.company_id)
        OR (
          public.user_has_role_for_company(
            auth.uid(),
            ir.company_id,
            ARRAY['division_leader', 'viewer']::app_role[]
          )
          AND public.can_access_child(_child_id)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_insert_incident_child(_incident_id uuid, _child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.incident_reports ir
    WHERE ir.id = _incident_id
      AND ir.company_id IS NOT NULL
      AND (
        public.user_can_manage_incidents(auth.uid(), ir.company_id)
        OR (
          public.user_has_role_for_company(
            auth.uid(),
            ir.company_id,
            ARRAY['division_leader', 'specialist']::public.app_role[]
          )
          AND public.can_access_child(_child_id)
        )
      )
  );
$$;

DO $$
DECLARE
  p record;
BEGIN
  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'incident_reports'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.incident_reports;', p.policyname);
  END LOOP;

  FOR p IN
    SELECT policyname
    FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'incident_children'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.incident_children;', p.policyname);
  END LOOP;
END $$;

ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_children ENABLE ROW LEVEL SECURITY;

CREATE POLICY "incident_reports_select"
ON public.incident_reports
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    company_id IS NOT NULL
    AND (
      public.user_can_manage_incidents(auth.uid(), company_id)
      OR (
        public.user_has_role_for_company(
          auth.uid(),
          company_id,
          ARRAY['division_leader', 'viewer']::app_role[]
        )
        AND (
          (child_id IS NOT NULL AND public.can_access_child(child_id))
          OR public.incident_has_accessible_child(incident_reports.id)
        )
      )
    )
  )
);

CREATE POLICY "incident_reports_insert"
ON public.incident_reports
FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    company_id IS NOT NULL
    AND public.user_can_create_incident_reports(auth.uid(), company_id)
  )
);

CREATE POLICY "incident_reports_update"
ON public.incident_reports
FOR UPDATE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    company_id IS NOT NULL
    AND public.user_can_manage_incidents(auth.uid(), company_id)
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    company_id IS NOT NULL
    AND public.user_can_manage_incidents(auth.uid(), company_id)
  )
);

CREATE POLICY "incident_reports_delete"
ON public.incident_reports
FOR DELETE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    company_id IS NOT NULL
    AND public.user_can_manage_incidents(auth.uid(), company_id)
  )
);

CREATE POLICY "incident_children_select"
ON public.incident_children
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.can_view_incident_children(incident_children.incident_id, incident_children.child_id)
);

CREATE POLICY "incident_children_insert"
ON public.incident_children
FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.can_insert_incident_child(incident_children.incident_id, incident_children.child_id)
);

CREATE POLICY "incident_children_update"
ON public.incident_children
FOR UPDATE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.can_manage_incident_children(incident_children.incident_id)
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.can_manage_incident_children(incident_children.incident_id)
);

CREATE POLICY "incident_children_delete"
ON public.incident_children
FOR DELETE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.can_manage_incident_children(incident_children.incident_id)
);

-- ---------------------------------------------------------------------------
-- Done. Verify policies exist:
-- SELECT tablename, policyname FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN ('roster_templates', 'incident_reports')
-- ORDER BY tablename, policyname;
-- ---------------------------------------------------------------------------
