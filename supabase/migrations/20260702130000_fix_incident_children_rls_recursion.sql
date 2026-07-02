-- Fix "infinite recursion detected in policy for relation incident_children" (42P17).
--
-- Root cause: incident_reports_select queried incident_children, and
-- incident_children_select queried incident_reports. Each table's RLS policy
-- triggered the other's, looping forever.
--
-- Fix: move the cross-table checks into SECURITY DEFINER helper functions. These
-- run as the function owner (table owner) and bypass RLS on the inner query, so
-- the policies no longer re-trigger each other.

-- Does the current user have access to any child linked to this incident (junction)?
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

-- Can the current user manage the parent incident for an incident_children row?
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

-- Can the current user view a specific incident_children row?
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

-- Recreate incident_reports SELECT without a direct subquery on incident_children.
DROP POLICY IF EXISTS "incident_reports_select" ON public.incident_reports;
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

-- Recreate incident_children policies without direct subqueries on incident_reports.
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
  OR public.can_manage_incident_children(incident_children.incident_id)
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
