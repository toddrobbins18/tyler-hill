-- Run in Supabase SQL Editor if parent login shows "Camp not found".
-- Enables public camp lookup by slug for /parents?company=...

CREATE OR REPLACE FUNCTION public.get_parent_portal_company(_slug text)
RETURNS TABLE (
  id uuid,
  name text,
  theme_color text,
  slug text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT c.id, c.name, c.theme_color, c.slug
  FROM public.companies c
  WHERE c.slug = _slug
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_parent_portal_company(text) TO anon, authenticated;
