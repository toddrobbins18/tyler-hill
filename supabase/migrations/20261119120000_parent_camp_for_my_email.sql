-- Parent login: the signed-in email already on a camper decides the camp.

CREATE OR REPLACE FUNCTION public.parent_camp_for_my_email()
RETURNS TABLE (
  company_id uuid,
  slug text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.company_id, co.slug
  FROM public.children c
  JOIN public.companies co ON co.id = c.company_id
  WHERE auth.uid() IS NOT NULL
    AND coalesce(c.status, 'active') <> 'inactive'
    AND lower(trim(c.guardian_email)) = lower(trim(auth.jwt() ->> 'email'))
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.parent_camp_for_my_email() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.parent_camp_for_my_email() TO authenticated;
