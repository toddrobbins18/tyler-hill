-- Run in Supabase SQL Editor after 02d if division leaders cannot edit incidents.
-- Safe to re-run.

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

DROP POLICY IF EXISTS "incident_reports_update" ON public.incident_reports;
CREATE POLICY "incident_reports_update"
ON public.incident_reports
FOR UPDATE TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR public.can_edit_incident_report(incident_reports.id)
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    company_id IS NOT NULL
    AND public.user_can_manage_incidents(auth.uid(), company_id)
  )
  OR (
    company_id IS NOT NULL
    AND public.user_matches_role_at_company(
      auth.uid(),
      company_id,
      ARRAY['division_leader', 'viewer']::public.app_role[]
    )
    AND (
      (child_id IS NOT NULL AND public.can_access_child(child_id))
      OR public.incident_has_accessible_child(incident_reports.id)
    )
  )
);

-- Gulbaz-style check (replace email)
SELECT
  p.email,
  public.user_can_create_incident_reports(p.id, c.id) AS can_create,
  public.can_edit_incident_report(ir.id) AS can_edit_sample
FROM public.profiles p
JOIN public.companies c ON c.id = p.company_id
LEFT JOIN LATERAL (
  SELECT id FROM public.incident_reports
  WHERE company_id = c.id
  ORDER BY created_at DESC NULLS LAST
  LIMIT 1
) ir ON true
WHERE p.email ILIKE '%gulbaz%'
  AND c.name ILIKE '%tyler%';
