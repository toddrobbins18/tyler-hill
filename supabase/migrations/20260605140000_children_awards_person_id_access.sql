-- Let division leaders resolve prior-season child rows (and their awards) when the
-- same camper is on their current roster via person_id.

CREATE OR REPLACE FUNCTION public.normalize_person_id_for_match(raw text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT NULLIF(
    regexp_replace(trim(COALESCE(raw, '')), '\.0+$', ''),
    ''
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_access_child_person_id(_person_id text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.children accessible
    WHERE accessible.company_id = public.get_user_company(auth.uid())
      AND public.normalize_person_id_for_match(accessible.person_id)
        = public.normalize_person_id_for_match(_person_id)
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'staff'::app_role)
        OR public.has_role(auth.uid(), 'health_center'::app_role)
        OR public.has_role(auth.uid(), 'specialist'::app_role)
        OR (
          (
            public.has_role(auth.uid(), 'division_leader'::app_role)
            OR public.has_role(auth.uid(), 'viewer'::app_role)
          )
          AND accessible.division_id = ANY(COALESCE(public.get_user_divisions(auth.uid()), ARRAY[]::uuid[]))
        )
      )
  )
$$;

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
      AND c.company_id = public.get_user_company(auth.uid())
      AND (
        public.has_role(auth.uid(), 'admin'::app_role)
        OR public.has_role(auth.uid(), 'staff'::app_role)
        OR public.has_role(auth.uid(), 'health_center'::app_role)
        OR public.has_role(auth.uid(), 'specialist'::app_role)
        OR (
          (
            public.has_role(auth.uid(), 'division_leader'::app_role)
            OR public.has_role(auth.uid(), 'viewer'::app_role)
          )
          AND (
            c.division_id = ANY(COALESCE(public.get_user_divisions(auth.uid()), ARRAY[]::uuid[]))
            OR public.user_can_access_child_person_id(c.person_id)
          )
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_award(_child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.can_access_child(_child_id)
$$;

DROP POLICY IF EXISTS "Users can view children from their company" ON public.children;

CREATE POLICY "Users can view children from their company"
ON public.children
FOR SELECT
USING (
  (company_id = public.get_user_company(auth.uid()))
  AND (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'staff'::app_role)
    OR public.has_role(auth.uid(), 'health_center'::app_role)
    OR public.has_role(auth.uid(), 'specialist'::app_role)
    OR (
      (
        public.has_role(auth.uid(), 'division_leader'::app_role)
        OR public.has_role(auth.uid(), 'viewer'::app_role)
      )
      AND (
        division_id = ANY(COALESCE(public.get_user_divisions(auth.uid()), ARRAY[]::uuid[]))
        OR public.user_can_access_child_person_id(person_id)
      )
    )
  )
);

DROP POLICY IF EXISTS "Users can view awards from their company" ON public.awards;

CREATE POLICY "Users can view awards from their company"
ON public.awards
FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR (
    company_id = public.get_user_company(auth.uid())
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'staff'::app_role)
      OR (child_id IS NOT NULL AND public.can_access_award(child_id))
    )
  )
);
