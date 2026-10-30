-- Per-user read cursors for division channel posts (recipient_id is NULL on channel messages).

CREATE TABLE IF NOT EXISTS public.division_channel_read_cursors (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  thread_root_id uuid NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, thread_root_id)
);

CREATE INDEX IF NOT EXISTS idx_division_channel_read_cursors_root
  ON public.division_channel_read_cursors (thread_root_id);

ALTER TABLE public.division_channel_read_cursors ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.mark_division_channel_read(_root_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  div_id uuid;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT m.division_id INTO div_id
  FROM public.messages m
  WHERE m.id = _root_id
    AND m.thread_kind = 'division_channel'
    AND m.parent_message_id IS NULL;

  IF div_id IS NULL OR NOT public.staff_can_access_division_messaging(uid, div_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  INSERT INTO public.division_channel_read_cursors (user_id, thread_root_id, last_read_at)
  VALUES (uid, _root_id, now())
  ON CONFLICT (user_id, thread_root_id)
  DO UPDATE SET last_read_at = EXCLUDED.last_read_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_division_channel_read(uuid) TO authenticated;

DROP FUNCTION IF EXISTS public.list_staff_division_channels(uuid);

CREATE OR REPLACE FUNCTION public.list_staff_division_channels(_company_id uuid)
RETURNS TABLE (
  division_id uuid,
  division_name text,
  thread_root_id uuid,
  latest_preview text,
  latest_at timestamptz,
  unread_for_staff bigint
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    d.id,
    d.name,
    root.id,
    COALESCE(latest.content, root.content, '') AS preview,
    COALESCE(latest.created_at, root.created_at) AS at,
    CASE
      WHEN root.id IS NULL THEN 0::bigint
      ELSE COALESCE(
        (
          SELECT COUNT(*)::bigint
          FROM public.messages post
          LEFT JOIN public.division_channel_read_cursors cur
            ON cur.thread_root_id = root.id AND cur.user_id = uid
          WHERE post.parent_message_id = root.id
            AND post.sender_id IS DISTINCT FROM uid
            AND post.created_at > COALESCE(cur.last_read_at, '-infinity'::timestamptz)
        ),
        0::bigint
      )
    END AS unread_for_staff
  FROM public.divisions d
  LEFT JOIN LATERAL (
    SELECT m.id, m.content, m.created_at
    FROM public.messages m
    WHERE m.parent_message_id IS NULL
      AND m.thread_kind = 'division_channel'
      AND m.division_id = d.id
    ORDER BY m.created_at ASC
    LIMIT 1
  ) root ON true
  LEFT JOIN LATERAL (
    SELECT m.content, m.created_at
    FROM public.messages m
    WHERE m.parent_message_id = root.id
    ORDER BY m.created_at DESC
    LIMIT 1
  ) latest ON root.id IS NOT NULL
  WHERE d.company_id = _company_id
    AND d.is_active IS NOT FALSE
    AND public.staff_can_access_division_messaging(uid, d.id)
  ORDER BY d.sort_order NULLS LAST, d.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_staff_division_channels(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.count_staff_division_channel_unread(_company_id uuid)
RETURNS bigint
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(x.unread_for_staff), 0)::bigint
  FROM public.list_staff_division_channels(_company_id) AS x;
$$;

GRANT EXECUTE ON FUNCTION public.count_staff_division_channel_unread(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
