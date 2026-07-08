-- DEPRECATED — use supabase/scripts/incident_rls/ step-by-step scripts instead.
-- Todd rule: Admin full camp, DL/Viewer scoped, Staff blocked.
-- Run: incident_rls/01_backup → 02_apply_fix_admin_dl_only → 03_verify

-- Unified incident report RLS: anyone with Incidents page access can create + view
-- appropriately. Fixes per-staff RLS errors when INSERT worked but SELECT/children failed.

-- Match role via user_roles OR profiles.role (some Tyler Hill staff only have profiles.role).
CREATE OR REPLACE FUNCTION public.user_matches_role_at_company(
  _user_id uuid,
  _company_id uuid,
  _roles public.app_role[]
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_has_role_for_company(_user_id, _company_id, _roles)
    OR EXISTS (
      SELECT 1
      FROM public.profiles p
      WHERE p.id = _user_id
        AND p.company_id = _company_id
        AND p.role IS NOT NULL
        AND p.role = ANY(SELECT unnest(_roles)::text)
    );
$$;

CREATE OR REPLACE FUNCTION public.user_has_incidents_page_access(
  _user_id uuid,
  _company_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.role_permissions rp
      ON rp.company_id = _company_id
     AND rp.role = ur.role
     AND rp.menu_item = 'incidents'
     AND rp.can_access = true
    WHERE ur.user_id = _user_id
      AND ur.company_id = _company_id
  )
  OR EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.role_permissions rp
      ON rp.company_id = _company_id
     AND rp.menu_item = 'incidents'
     AND rp.can_access = true
     AND rp.role::text = p.role
    WHERE p.id = _user_id
      AND p.company_id = _company_id
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_manage_incidents(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_matches_role_at_company(
    _user_id,
    _company_id,
    ARRAY['admin', 'staff', 'health_center']::public.app_role[]
  );
$$;

-- Full-company incident visibility (staff, specialist, admin, health_center).
CREATE OR REPLACE FUNCTION public.user_can_view_all_company_incidents(
  _user_id uuid,
  _company_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_matches_role_at_company(
    _user_id,
    _company_id,
    ARRAY['admin', 'staff', 'health_center', 'specialist']::public.app_role[]
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
  SELECT public.is_super_admin(_user_id)
    OR public.user_has_incidents_page_access(_user_id, _company_id)
    OR public.user_can_view_all_company_incidents(_user_id, _company_id)
    OR public.user_matches_role_at_company(
      _user_id,
      _company_id,
      ARRAY['division_leader', 'viewer']::public.app_role[]
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
    JOIN public.children c ON c.id = _child_id
    WHERE ir.id = _incident_id
      AND ir.company_id IS NOT NULL
      AND c.company_id = ir.company_id
      AND public.user_can_create_incident_reports(auth.uid(), ir.company_id)
      AND (
        public.user_can_view_all_company_incidents(auth.uid(), ir.company_id)
        OR public.user_can_manage_incidents(auth.uid(), ir.company_id)
        OR public.can_access_child(_child_id)
      )
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
        public.user_can_view_all_company_incidents(auth.uid(), ir.company_id)
        OR public.user_can_manage_incidents(auth.uid(), ir.company_id)
        OR (
          public.user_can_create_incident_reports(auth.uid(), ir.company_id)
          AND public.can_access_child(_child_id)
        )
        OR (
          public.user_matches_role_at_company(
            auth.uid(),
            ir.company_id,
            ARRAY['division_leader', 'viewer']::public.app_role[]
          )
          AND public.can_access_child(_child_id)
        )
      )
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

DROP POLICY IF EXISTS "incident_reports_select" ON public.incident_reports;
CREATE POLICY "incident_reports_select"
ON public.incident_reports
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    company_id IS NOT NULL
    AND (
      public.user_can_view_all_company_incidents(auth.uid(), company_id)
      OR public.user_can_manage_incidents(auth.uid(), company_id)
      OR (
        public.user_matches_role_at_company(
          auth.uid(),
          company_id,
          ARRAY['division_leader', 'viewer']::public.app_role[]
        )
        AND (
          (child_id IS NOT NULL AND public.can_access_child(child_id))
          OR public.incident_has_accessible_child(incident_reports.id)
        )
      )
      OR (
        public.user_has_incidents_page_access(auth.uid(), company_id)
        AND public.incident_has_accessible_child(incident_reports.id)
      )
    )
  )
);

DROP POLICY IF EXISTS "incident_reports_insert" ON public.incident_reports;
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

DROP POLICY IF EXISTS "incident_reports_update" ON public.incident_reports;
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

DROP POLICY IF EXISTS "incident_reports_delete" ON public.incident_reports;
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

DROP POLICY IF EXISTS "incident_children_select" ON public.incident_children;
CREATE POLICY "incident_children_select"
ON public.incident_children
FOR SELECT TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.can_view_incident_children(incident_children.incident_id, incident_children.child_id)
);

DROP POLICY IF EXISTS "incident_children_insert" ON public.incident_children;
CREATE POLICY "incident_children_insert"
ON public.incident_children
FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.can_insert_incident_child(incident_children.incident_id, incident_children.child_id)
);

DROP POLICY IF EXISTS "incident_children_update" ON public.incident_children;
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

DROP POLICY IF EXISTS "incident_children_delete" ON public.incident_children;
CREATE POLICY "incident_children_delete"
ON public.incident_children
FOR DELETE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.can_manage_incident_children(incident_children.incident_id)
);

INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT c.id, r.role, 'incidents', true
FROM public.companies c
CROSS JOIN unnest(ARRAY[
  'admin',
  'staff',
  'health_center',
  'division_leader',
  'specialist',
  'viewer'
]::public.app_role[]) AS r(role)
WHERE COALESCE(c.is_active, true) = true
ON CONFLICT (company_id, role, menu_item)
DO UPDATE SET can_access = true;

-- Backfill user_roles from profiles so has_role() and other RLS helpers stay in sync.
INSERT INTO public.user_roles (user_id, role, company_id)
SELECT p.id, p.role::public.app_role, p.company_id
FROM public.profiles p
WHERE p.company_id IS NOT NULL
  AND p.role IN (
    'admin',
    'staff',
    'health_center',
    'division_leader',
    'specialist',
    'viewer'
  )
  AND NOT EXISTS (
    SELECT 1
    FROM public.user_roles ur
    WHERE ur.user_id = p.id
      AND ur.role = p.role::public.app_role
  );
