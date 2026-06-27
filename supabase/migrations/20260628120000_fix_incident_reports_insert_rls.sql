-- Fix incident report create/read RLS (admin/staff/health_center, multi-camp admins, DL view via incident_children).
-- Tyler Hill prod was missing later incident policy migrations; 20260627000000 only replaced SELECT
-- and still keyed on profiles.company_id, which breaks multi-camp admins and incident_children rows.

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
          (
            child_id IS NOT NULL
            AND public.can_access_child(child_id)
          )
          OR EXISTS (
            SELECT 1
            FROM public.incident_children ic
            WHERE ic.incident_id = incident_reports.id
              AND public.can_access_child(ic.child_id)
          )
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
    AND public.user_can_manage_incidents(auth.uid(), company_id)
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
  OR EXISTS (
    SELECT 1
    FROM public.incident_reports ir
    WHERE ir.id = incident_children.incident_id
      AND ir.company_id IS NOT NULL
      AND (
        public.user_can_manage_incidents(auth.uid(), ir.company_id)
        OR (
          public.user_has_role_for_company(
            auth.uid(),
            ir.company_id,
            ARRAY['division_leader', 'viewer']::app_role[]
          )
          AND public.can_access_child(incident_children.child_id)
        )
      )
  )
);

CREATE POLICY "incident_children_insert"
ON public.incident_children
FOR INSERT TO authenticated
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.incident_reports ir
    WHERE ir.id = incident_children.incident_id
      AND ir.company_id IS NOT NULL
      AND public.user_can_manage_incidents(auth.uid(), ir.company_id)
  )
);

CREATE POLICY "incident_children_update"
ON public.incident_children
FOR UPDATE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.incident_reports ir
    WHERE ir.id = incident_children.incident_id
      AND ir.company_id IS NOT NULL
      AND public.user_can_manage_incidents(auth.uid(), ir.company_id)
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.incident_reports ir
    WHERE ir.id = incident_children.incident_id
      AND ir.company_id IS NOT NULL
      AND public.user_can_manage_incidents(auth.uid(), ir.company_id)
  )
);

CREATE POLICY "incident_children_delete"
ON public.incident_children
FOR DELETE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.incident_reports ir
    WHERE ir.id = incident_children.incident_id
      AND ir.company_id IS NOT NULL
      AND public.user_can_manage_incidents(auth.uid(), ir.company_id)
  )
);
