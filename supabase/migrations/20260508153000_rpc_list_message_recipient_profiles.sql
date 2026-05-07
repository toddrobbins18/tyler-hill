-- Message compose lists recipients from profiles.company_id = camp.
-- Direct SELECT hits RLS ("own profile or admin only"), so normal staff only see themselves.
-- This RPC validates the caller belongs to the target camp, then reads peers with SECURITY DEFINER.

CREATE OR REPLACE FUNCTION public.list_message_recipient_profiles(target_company_id uuid)
RETURNS TABLE (id uuid, full_name text, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF target_company_id IS NULL THEN
    RAISE EXCEPTION 'invalid company';
  END IF;

  IF NOT (
    public.is_super_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.company_id = target_company_id
    )
    OR EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = auth.uid()
        AND ur.company_id = target_company_id
    )
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT p.id, p.full_name, p.email
  FROM public.profiles p
  WHERE p.company_id = target_company_id
  ORDER BY p.full_name ASC NULLS LAST, p.email ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.list_message_recipient_profiles(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_message_recipient_profiles(uuid) TO authenticated;

COMMENT ON FUNCTION public.list_message_recipient_profiles(uuid)
  IS 'Returns camp profile rows for message recipient pickers (bypasses profiles RLS after authz).';
