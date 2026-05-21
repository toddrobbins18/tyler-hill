-- Specialists should see all campers in their company (matches app usePermissions / roster UI).
-- Previously specialists were division-scoped in RLS while the client treated them as full-access.

DROP POLICY IF EXISTS "Users can view children from their company" ON public.children;

CREATE POLICY "Users can view children from their company"
ON public.children
FOR SELECT
USING (
  (company_id = get_user_company(auth.uid()))
  AND (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
    OR has_role(auth.uid(), 'health_center'::app_role)
    OR has_role(auth.uid(), 'specialist'::app_role)
    OR (
      (has_role(auth.uid(), 'division_leader'::app_role) OR has_role(auth.uid(), 'viewer'::app_role))
      AND division_id = ANY(get_user_divisions(auth.uid()))
    )
  )
);

CREATE OR REPLACE FUNCTION public.can_access_child(_child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.children c
    WHERE c.id = _child_id
      AND c.company_id = get_user_company(auth.uid())
      AND (
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'staff'::app_role)
        OR has_role(auth.uid(), 'health_center'::app_role)
        OR has_role(auth.uid(), 'specialist'::app_role)
        OR (
          (has_role(auth.uid(), 'division_leader'::app_role) OR has_role(auth.uid(), 'viewer'::app_role))
          AND c.division_id = ANY(get_user_divisions(auth.uid()))
        )
      )
  )
$$;
