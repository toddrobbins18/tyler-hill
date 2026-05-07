-- Profiles RLS often hides coworkers; resolve_message_profile_labels needs a matching camp id.
-- This RPC returns names for any profile id that appears in messages with auth.uid()
-- as the other party (any thread depth), without requiring camp context.

CREATE OR REPLACE FUNCTION public.resolve_profile_names_for_message_partners(profile_ids uuid[])
RETURNS TABLE (id uuid, full_name text, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.id, p.full_name, p.email
  FROM public.profiles p
  WHERE p.id = ANY(profile_ids)
    AND auth.uid() IS NOT NULL
    AND (
      public.is_super_admin(auth.uid())
      OR EXISTS (
        SELECT 1
        FROM public.messages m
        WHERE (m.sender_id = auth.uid() AND m.recipient_id = p.id)
           OR (m.recipient_id = auth.uid() AND m.sender_id = p.id)
      )
    );
$$;

REVOKE ALL ON FUNCTION public.resolve_profile_names_for_message_partners(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_profile_names_for_message_partners(uuid[]) TO authenticated;

COMMENT ON FUNCTION public.resolve_profile_names_for_message_partners(uuid[])
  IS 'Returns full_name/email for profile ids tied to messages with auth.uid() (partner labels for inbox UI).';
