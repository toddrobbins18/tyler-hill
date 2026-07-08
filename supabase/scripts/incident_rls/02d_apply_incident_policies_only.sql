-- Run in Supabase SQL Editor if division leaders still get RLS on INSERT
-- (functions from 02c exist but policies from Step 2 were never applied)
-- Safe to re-run

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

-- Confirm INSERT policy text (must mention user_can_create_incident_reports)
SELECT tablename, policyname, cmd, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('incident_reports', 'incident_children')
ORDER BY tablename, policyname;
