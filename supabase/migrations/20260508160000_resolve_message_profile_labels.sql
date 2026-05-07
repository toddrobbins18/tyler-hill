-- Inbox / bell / thread resolve sender names via profiles; direct SELECT is still blocked for many staff.
-- Same authorization as list_message_recipient_profiles, scoped to current camp (matches CompanyContext).

CREATE OR REPLACE FUNCTION public.resolve_message_profile_labels(
  profile_ids uuid[],
  target_company_id uuid
)
RETURNS TABLE (id uuid, full_name text, email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  IF target_company_id IS NULL OR profile_ids IS NULL OR cardinality(profile_ids) = 0 THEN
    RETURN;
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
    AND p.id = ANY(profile_ids)
  ORDER BY p.full_name ASC NULLS LAST, p.email ASC;
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_message_profile_labels(uuid[], uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_message_profile_labels(uuid[], uuid) TO authenticated;

COMMENT ON FUNCTION public.resolve_message_profile_labels(uuid[], uuid)
  IS 'Returns id/full_name/email for profile ids in a camp (message sender display; bypasses profiles RLS after authz).';
