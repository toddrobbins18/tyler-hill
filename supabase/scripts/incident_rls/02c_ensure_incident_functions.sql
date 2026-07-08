-- Run if Step 3 verify says user_can_view_all_company_incidents (or similar) does not exist.
-- Creates all incident RLS helper functions. Safe to re-run.
-- Then run 03_verify_after_fix.sql again.

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
    ARRAY['admin']::public.app_role[]
  );
$$;

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
    ARRAY['admin']::public.app_role[]
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
    OR public.user_matches_role_at_company(
      _user_id,
      _company_id,
      ARRAY['admin']::public.app_role[]
    )
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
        OR (
          public.user_can_create_incident_reports(auth.uid(), ir.company_id)
          AND public.can_access_child(_child_id)
        )
      )
  );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_incident_report(_incident_id uuid)
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
          public.user_matches_role_at_company(
            auth.uid(),
            ir.company_id,
            ARRAY['division_leader', 'viewer']::public.app_role[]
          )
          AND (
            (ir.child_id IS NOT NULL AND public.can_access_child(ir.child_id))
            OR public.incident_has_accessible_child(_incident_id)
          )
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
  SELECT public.can_edit_incident_report(_incident_id);
$$;

-- Confirm functions exist
SELECT proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND proname IN (
    'user_matches_role_at_company',
    'user_has_incidents_page_access',
    'user_can_manage_incidents',
    'user_can_view_all_company_incidents',
    'user_can_create_incident_reports',
    'incident_has_accessible_child',
    'can_insert_incident_child',
    'can_view_incident_children',
    'can_edit_incident_report',
    'can_manage_incident_children'
  )
ORDER BY proname;
