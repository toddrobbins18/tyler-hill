-- Phase 6: Staff-to-all-families announcement timeline (parent portal home + push via Realtime).

CREATE TABLE IF NOT EXISTS public.parent_portal_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  season text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  is_published boolean NOT NULL DEFAULT true,
  published_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_parent_portal_announcements_company_published
  ON public.parent_portal_announcements (company_id, published_at DESC)
  WHERE is_published = true;

COMMENT ON TABLE public.parent_portal_announcements IS
  'Camp-wide posts to parent portal home (Messages → Announcements).';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_portal_announcements TO authenticated;
GRANT ALL ON public.parent_portal_announcements TO service_role;

ALTER TABLE public.parent_portal_announcements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage parent portal announcements" ON public.parent_portal_announcements;
CREATE POLICY "Staff manage parent portal announcements"
  ON public.parent_portal_announcements
  FOR ALL
  TO authenticated
  USING (public.user_can_manage_parent_portal_data(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_parent_portal_data(auth.uid(), company_id));

DROP POLICY IF EXISTS "Parents read published announcements" ON public.parent_portal_announcements;
CREATE POLICY "Parents read published announcements"
  ON public.parent_portal_announcements
  FOR SELECT
  TO authenticated
  USING (
    is_published
    AND company_id IN (
      SELECT f.company_id FROM public.families f WHERE f.user_id = auth.uid()
    )
  );

CREATE OR REPLACE FUNCTION public.list_staff_parent_portal_announcements(
  _company_id uuid,
  _season text
)
RETURNS SETOF public.parent_portal_announcements
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  IF NOT public.user_can_manage_parent_portal_data(auth.uid(), _company_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;

  RETURN QUERY
  SELECT a.*
  FROM public.parent_portal_announcements a
  WHERE a.company_id = _company_id
    AND a.season = _season
  ORDER BY a.published_at DESC, a.created_at DESC
  LIMIT 100;
END;
$$;

GRANT EXECUTE ON FUNCTION public.list_staff_parent_portal_announcements(uuid, text) TO authenticated;

CREATE OR REPLACE FUNCTION public.publish_parent_portal_announcement(
  _company_id uuid,
  _season text,
  _title text,
  _body text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid;
  t text := trim(coalesce(_title, ''));
  b text := trim(coalesce(_body, ''));
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  IF NOT public.user_can_manage_parent_portal_data(uid, _company_id) THEN
    RAISE EXCEPTION 'Forbidden';
  END IF;
  IF b = '' THEN RAISE EXCEPTION 'Empty announcement'; END IF;

  INSERT INTO public.parent_portal_announcements (
    company_id,
    season,
    title,
    body,
    is_published,
    published_at,
    created_by
  ) VALUES (
    _company_id,
    _season,
    COALESCE(NULLIF(t, ''), 'Camp announcement'),
    b,
    true,
    now(),
    uid
  )
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.publish_parent_portal_announcement(uuid, text, text, text) TO authenticated;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'parent_portal_announcements'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.parent_portal_announcements;
  END IF;
EXCEPTION
  WHEN undefined_object THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
