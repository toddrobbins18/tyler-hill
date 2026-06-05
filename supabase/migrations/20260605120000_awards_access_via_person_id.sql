-- Allow division leaders to view awards linked to prior-season child rows when the
-- award camper matches a child they can access via person_id (same camper, new season row).

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

CREATE OR REPLACE FUNCTION public.can_access_award(_child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.can_access_child(_child_id)
    OR EXISTS (
      SELECT 1
      FROM public.children award_child
      INNER JOIN public.children accessible_child
        ON award_child.company_id = accessible_child.company_id
        AND public.normalize_person_id_for_match(award_child.person_id)
          = public.normalize_person_id_for_match(accessible_child.person_id)
      WHERE award_child.id = _child_id
        AND award_child.company_id = get_user_company(auth.uid())
        AND public.can_access_child(accessible_child.id)
    )
$$;

DROP POLICY IF EXISTS "Users can view awards from their company" ON public.awards;

CREATE POLICY "Users can view awards from their company"
ON public.awards
FOR SELECT
USING (
  is_super_admin(auth.uid())
  OR (
    company_id = get_user_company(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR (child_id IS NOT NULL AND public.can_access_award(child_id))
    )
  )
);
