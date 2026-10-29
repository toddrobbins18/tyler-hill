-- Parent portal users (family login) must read message-media objects for threads they are in.

CREATE OR REPLACE FUNCTION public.user_can_access_message_media_path(_user_id uuid, _storage_path text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    _user_id IS NOT NULL
    AND _storage_path IS NOT NULL
    AND length(trim(_storage_path)) > 0
    AND (
      EXISTS (
        SELECT 1
        FROM public.messages m
        WHERE m.media_storage_path = _storage_path
          AND (_user_id = m.sender_id OR _user_id = m.recipient_id)
      )
      OR EXISTS (
        SELECT 1
        FROM public.group_messages gm
        JOIN public.message_group_members mgm
          ON mgm.group_id = gm.group_id
         AND mgm.user_id = _user_id
        WHERE gm.media_storage_path = _storage_path
      )
      OR public.user_can_access_message_media(
        _user_id,
        (split_part(_storage_path, '/', 1))::uuid
      )
      OR EXISTS (
        SELECT 1
        FROM public.families f
        WHERE f.user_id = _user_id
          AND f.company_id = (split_part(_storage_path, '/', 1))::uuid
      )
    );
$$;

GRANT EXECUTE ON FUNCTION public.user_can_access_message_media_path(uuid, text) TO authenticated;

DROP POLICY IF EXISTS "Message media read" ON storage.objects;
CREATE POLICY "Message media read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'message-media'
    AND public.user_can_access_message_media_path(auth.uid(), name)
  );

DROP POLICY IF EXISTS "Message media insert" ON storage.objects;
CREATE POLICY "Message media insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'message-media'
    AND (
      public.user_can_access_message_media(
        auth.uid(),
        ((storage.foldername(name))[1])::uuid
      )
      OR EXISTS (
        SELECT 1
        FROM public.families f
        WHERE f.user_id = auth.uid()
          AND f.company_id = ((storage.foldername(name))[1])::uuid
      )
    )
  );

NOTIFY pgrst, 'reload schema';
