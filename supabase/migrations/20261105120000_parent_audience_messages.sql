-- Group and bus messages on the parent portal.
-- Camp-wide announcements stay audience_kind = 'all'.
-- Targeted rows store the camper ids who should see them.

ALTER TABLE public.parent_portal_announcements
  ADD COLUMN IF NOT EXISTS audience_kind text NOT NULL DEFAULT 'all',
  ADD COLUMN IF NOT EXISTS audience_label text,
  ADD COLUMN IF NOT EXISTS week_numbers int[],
  ADD COLUMN IF NOT EXISTS message_everyone boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS audience_child_ids uuid[];

ALTER TABLE public.parent_portal_announcements
  DROP CONSTRAINT IF EXISTS parent_portal_announcements_audience_kind_check;

ALTER TABLE public.parent_portal_announcements
  ADD CONSTRAINT parent_portal_announcements_audience_kind_check
  CHECK (audience_kind IN ('all', 'group', 'bus'));

CREATE OR REPLACE FUNCTION public.parent_can_read_announcement(_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.parent_portal_announcements a
    WHERE a.id = _id
      AND a.is_published
      AND (
        COALESCE(a.audience_kind, 'all') = 'all'
        OR public.user_can_manage_parent_portal_data(auth.uid(), a.company_id)
        OR (
          auth.uid() IS NOT NULL
          AND EXISTS (
            SELECT 1
            FROM public.family_children fc
            JOIN public.families f ON f.id = fc.family_id
            WHERE f.user_id = auth.uid()
              AND fc.child_id = ANY (COALESCE(a.audience_child_ids, '{}'::uuid[]))
          )
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.parent_can_read_announcement(uuid) TO authenticated;

DROP POLICY IF EXISTS "Parents read published announcements" ON public.parent_portal_announcements;
CREATE POLICY "Parents read published announcements"
  ON public.parent_portal_announcements
  FOR SELECT
  TO authenticated
  USING (public.parent_can_read_announcement(id));

CREATE OR REPLACE FUNCTION public.publish_parent_audience_message(
  _company_id uuid,
  _season text,
  _title text,
  _body text,
  _audience_kind text,
  _audience_label text,
  _week_numbers int[],
  _everyone boolean,
  _child_ids uuid[]
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid := gen_random_uuid();
  t text := trim(coalesce(_title, ''));
  b text := trim(coalesce(_body, ''));
  kind text := lower(trim(coalesce(_audience_kind, '')));
  label text := trim(coalesce(_audience_label, ''));
  allowed_ids uuid[];
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.user_can_manage_parent_portal_data(uid, _company_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF kind NOT IN ('group', 'bus') THEN RAISE EXCEPTION 'Choose a group or a bus'; END IF;
  IF label = '' THEN RAISE EXCEPTION 'Choose who to message'; END IF;
  IF b = '' THEN RAISE EXCEPTION 'Empty message'; END IF;

  SELECT COALESCE(array_agg(c.id), '{}'::uuid[])
  INTO allowed_ids
  FROM public.children c
  WHERE c.company_id = _company_id
    AND c.season = _season
    AND c.id = ANY (COALESCE(_child_ids, '{}'::uuid[]));

  IF COALESCE(array_length(allowed_ids, 1), 0) = 0 THEN
    RAISE EXCEPTION 'No campers match that audience';
  END IF;

  INSERT INTO public.parent_portal_announcements (
    id,
    company_id,
    season,
    title,
    body,
    is_published,
    published_at,
    created_by,
    audience_kind,
    audience_label,
    week_numbers,
    message_everyone,
    audience_child_ids
  ) VALUES (
    new_id,
    _company_id,
    _season,
    COALESCE(NULLIF(t, ''), CASE WHEN kind = 'bus' THEN 'Bus message' ELSE 'Group message' END),
    b,
    true,
    now(),
    uid,
    kind,
    label,
    CASE WHEN _everyone THEN NULL ELSE _week_numbers END,
    COALESCE(_everyone, false),
    allowed_ids
  );

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_parent_audience_message(
  uuid, text, text, text, text, text, int[], boolean, uuid[]
) TO authenticated;
