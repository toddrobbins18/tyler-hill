-- Widen resolve_message_profile_labels so senders appear even when profiles.company_id
-- does not match the active camp (common with multi-camp accounts) as long as the viewer
-- has a 1:1 message thread with that profile (same rule as resolve_profile_names_for_message_partners).

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
  SELECT DISTINCT ON (p.id)
    p.id,
    p.full_name,
    p.email
  FROM public.profiles p
  WHERE p.id = ANY(profile_ids)
    AND (
      p.company_id = target_company_id
      OR EXISTS (
        SELECT 1
        FROM public.messages m
        WHERE (m.sender_id = auth.uid() AND m.recipient_id = p.id)
           OR (m.recipient_id = auth.uid() AND m.sender_id = p.id)
      )
    )
  ORDER BY
    p.id,
    (CASE WHEN p.company_id = target_company_id THEN 0 ELSE 1 END),
    p.full_name ASC NULLS LAST,
    p.email ASC;
END;
$$;

COMMENT ON FUNCTION public.resolve_message_profile_labels(uuid[], uuid)
  IS 'Camp-scoped OR message-partner profiles (fixes missing sender names when profile.company_id differs from active camp).';
