-- Phase 1: Parent portal ↔ division leader messaging (reuse public.messages).

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS child_id uuid REFERENCES public.children(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS family_id uuid REFERENCES public.families(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS thread_kind text;

CREATE INDEX IF NOT EXISTS idx_messages_parent_portal_thread
  ON public.messages (child_id, thread_kind)
  WHERE parent_message_id IS NULL AND thread_kind = 'parent_division_leader';

COMMENT ON COLUMN public.messages.thread_kind IS
  'e.g. parent_division_leader for family portal threads; NULL for staff Nest messages.';

CREATE OR REPLACE FUNCTION public.parent_owns_child(_child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_children fc
    JOIN public.families f ON f.id = fc.family_id
    WHERE fc.child_id = _child_id
      AND f.user_id = auth.uid()
  );
$$;

GRANT EXECUTE ON FUNCTION public.parent_owns_child(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_division_leader_for_camper(_child_id uuid)
RETURNS TABLE (
  user_id uuid,
  display_name text,
  resolution_source text
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cid uuid := _child_id;
  camp_id uuid;
  div_id uuid;
  leader_staff_id uuid;
BEGIN
  IF cid IS NULL OR NOT public.parent_owns_child(cid) THEN
    RETURN;
  END IF;

  SELECT c.company_id, c.division_id, c.leader_id
  INTO camp_id, div_id, leader_staff_id
  FROM public.children c
  WHERE c.id = cid;

  IF leader_staff_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      p.id,
      COALESCE(NULLIF(trim(s.name), ''), NULLIF(trim(p.full_name), ''), split_part(p.email, '@', 1)),
      'camper_leader'::text
    FROM public.staff s
    LEFT JOIN public.profiles p
      ON lower(trim(coalesce(p.email, ''))) = lower(trim(coalesce(s.email, '')))
    WHERE s.id = leader_staff_id
      AND p.id IS NOT NULL
    LIMIT 1;
    IF FOUND THEN RETURN; END IF;
  END IF;

  IF div_id IS NOT NULL THEN
    RETURN QUERY
    SELECT
      dp.user_id,
      COALESCE(NULLIF(trim(pr.full_name), ''), split_part(pr.email, '@', 1), 'Division leader'),
      'division_permissions'::text
    FROM public.division_permissions dp
    JOIN public.user_roles ur
      ON ur.user_id = dp.user_id
     AND ur.role = 'division_leader'
     AND ur.company_id = camp_id
    JOIN public.profiles pr ON pr.id = dp.user_id
    WHERE dp.division_id = div_id
      AND dp.can_access = true
    ORDER BY pr.full_name NULLS LAST
    LIMIT 1;
  END IF;

  RETURN;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resolve_division_leader_for_camper(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_or_create_parent_division_leader_thread(_child_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cid uuid := _child_id;
  fam_id uuid;
  camp_id uuid;
  child_name text;
  dl_user_id uuid;
  dl_name text;
  existing_id uuid;
  parent_id uuid := auth.uid();
BEGIN
  IF parent_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  IF NOT public.parent_owns_child(cid) THEN
    RAISE EXCEPTION 'Child not linked to your family';
  END IF;

  SELECT fc.family_id, c.company_id, c.name
  INTO fam_id, camp_id, child_name
  FROM public.family_children fc
  JOIN public.children c ON c.id = fc.child_id
  WHERE fc.child_id = cid
  LIMIT 1;

  SELECT id INTO existing_id
  FROM public.messages m
  WHERE m.parent_message_id IS NULL
    AND m.thread_kind = 'parent_division_leader'
    AND m.child_id = cid
    AND (m.sender_id = parent_id OR m.recipient_id = parent_id)
  ORDER BY m.created_at ASC
  LIMIT 1;

  IF existing_id IS NOT NULL THEN
    RETURN existing_id;
  END IF;

  SELECT r.user_id, r.display_name
  INTO dl_user_id, dl_name
  FROM public.resolve_division_leader_for_camper(cid) r
  LIMIT 1;

  IF dl_user_id IS NULL THEN
    RAISE EXCEPTION 'No division leader is assigned for this camper yet';
  END IF;

  INSERT INTO public.messages (
    sender_id,
    recipient_id,
    subject,
    content,
    parent_message_id,
    notification_type,
    read,
    company_id,
    child_id,
    family_id,
    thread_kind
  ) VALUES (
    parent_id,
    dl_user_id,
    'Messages: ' || COALESCE(child_name, 'camper'),
    'Parent portal thread for ' || COALESCE(child_name, 'camper') || COALESCE(' · Division leader: ' || dl_name, ''),
    NULL,
    'message',
    false,
    camp_id,
    cid,
    fam_id,
    'parent_division_leader'
  )
  RETURNING id INTO existing_id;

  RETURN existing_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_or_create_parent_division_leader_thread(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.list_parent_portal_message_threads(_company_id uuid)
RETURNS TABLE (
  child_id uuid,
  child_name text,
  group_name text,
  division_leader_user_id uuid,
  division_leader_name text,
  thread_root_id uuid,
  latest_preview text,
  latest_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  fam_id uuid;
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RETURN; END IF;

  SELECT f.id INTO fam_id
  FROM public.families f
  WHERE f.user_id = uid AND f.company_id = _company_id
  LIMIT 1;

  IF fam_id IS NULL THEN RETURN; END IF;

  RETURN QUERY
  SELECT
    c.id AS child_id,
    c.name AS child_name,
    c.group_name,
    dl.user_id AS division_leader_user_id,
    dl.display_name AS division_leader_name,
    root.id AS thread_root_id,
    COALESCE(latest.content, root.content, '') AS latest_preview,
    COALESCE(latest.created_at, root.created_at) AS latest_at
  FROM public.family_children fc
  JOIN public.children c ON c.id = fc.child_id
  LEFT JOIN LATERAL (
    SELECT r.user_id, r.display_name
    FROM public.resolve_division_leader_for_camper(c.id) r
    LIMIT 1
  ) dl ON true
  LEFT JOIN LATERAL (
    SELECT m.id, m.content, m.created_at
    FROM public.messages m
    WHERE m.parent_message_id IS NULL
      AND m.thread_kind = 'parent_division_leader'
      AND m.child_id = c.id
      AND (m.sender_id = uid OR m.recipient_id = uid)
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
  WHERE fc.family_id = fam_id
  ORDER BY c.name;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_parent_portal_message_threads(uuid) TO authenticated;

NOTIFY pgrst, 'reload schema';
