-- =============================================================================
-- STEP 4 — ROLLBACK (ONLY if Step 2 caused problems)
--
-- OPTION A (BEST): Paste and run the function definitions + policies you saved
--                  from Step 1B and Step 1A
--
-- OPTION B: Run this file to restore the PREVIOUS insert-only fix state
--           (20260707120000 era — staff could still create via old rules)
--           Then re-run Step 1 backup if you need to try Step 2 again
-- =============================================================================

-- Restore role_permissions: incidents enabled for all roles (previous default)
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
    ARRAY['admin', 'staff', 'health_center']::public.app_role[]
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
    OR public.user_has_role_for_company(
      _user_id,
      _company_id,
      ARRAY[
        'admin',
        'staff',
        'health_center',
        'division_leader',
        'specialist',
        'viewer'
      ]::public.app_role[]
    )
    OR (
      _company_id = public.get_user_company(_user_id)
      AND (
        public.has_role(_user_id, 'admin'::public.app_role)
        OR public.has_role(_user_id, 'staff'::public.app_role)
        OR public.has_role(_user_id, 'health_center'::public.app_role)
        OR public.has_role(_user_id, 'division_leader'::public.app_role)
        OR public.has_role(_user_id, 'specialist'::public.app_role)
        OR public.has_role(_user_id, 'viewer'::public.app_role)
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
      AND public.user_can_create_incident_reports(auth.uid(), ir.company_id)
      AND (
        public.user_can_manage_incidents(auth.uid(), ir.company_id)
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
        public.user_can_manage_incidents(auth.uid(), ir.company_id)
        OR (
          public.user_can_create_incident_reports(auth.uid(), ir.company_id)
          AND public.can_access_child(_child_id)
        )
        OR (
          public.user_has_role_for_company(
            auth.uid(),
            ir.company_id,
            ARRAY['division_leader', 'viewer']::public.app_role[]
          )
          AND public.can_access_child(_child_id)
        )
      )
  );
$$;

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

DROP POLICY IF EXISTS "incident_children_insert" ON public.incident_children;
CREATE POLICY "incident_children_insert"
ON public.incident_children
FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR public.can_insert_incident_child(incident_children.incident_id, incident_children.child_id)
);

-- NOTE: SELECT/UPDATE/DELETE policies are NOT fully restored here.
-- For full rollback, use your Step 1 backup (OPTION A).
