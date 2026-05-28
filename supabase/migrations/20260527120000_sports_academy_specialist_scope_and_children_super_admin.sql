-- Super admins need children SELECT for embedded/joined roster names (Sports Academy, etc.).
-- Also ensure specialists can read children when 20260521180000 was not yet applied.

DROP POLICY IF EXISTS "Users can view children from their company" ON public.children;

CREATE POLICY "Users can view children from their company"
ON public.children
FOR SELECT
USING (
  (company_id = get_user_company(auth.uid()))
  AND (
    is_super_admin(auth.uid())
    OR has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
    OR has_role(auth.uid(), 'health_center'::app_role)
    OR has_role(auth.uid(), 'specialist'::app_role)
    OR (
      (has_role(auth.uid(), 'division_leader'::app_role) OR has_role(auth.uid(), 'viewer'::app_role))
      AND division_id = ANY(get_user_divisions(auth.uid()))
    )
  )
);

CREATE OR REPLACE FUNCTION public.get_user_specialist_sports(_user_id uuid)
RETURNS text[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(array_agg(DISTINCT ssa.sport ORDER BY ssa.sport), ARRAY[]::text[])
  FROM public.specialist_sport_assignments ssa
  WHERE ssa.user_id = _user_id
    AND ssa.company_id = get_user_company(_user_id);
$$;

CREATE OR REPLACE FUNCTION public.can_access_sports_academy_sport(_sport_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    NOT has_role(auth.uid(), 'specialist'::app_role)
    OR _sport_name = ANY(public.get_user_specialist_sports(auth.uid()));
$$;

DROP POLICY IF EXISTS "Users can view sports academy from their company" ON public.sports_academy;

CREATE POLICY "Users can view sports academy from their company"
ON public.sports_academy
FOR SELECT
USING (
  is_super_admin(auth.uid())
  OR (
    company_id = get_user_company(auth.uid())
    AND public.can_access_sports_academy_sport(sport_name)
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR has_role(auth.uid(), 'specialist'::app_role)
      OR (child_id IS NOT NULL AND can_access_child(child_id))
    )
  )
);
