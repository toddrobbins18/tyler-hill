-- Parent Portal: staff-editable camp-wide announcements shown on the parent home tab.

CREATE TABLE IF NOT EXISTS public.parent_portal_camp_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  season text NOT NULL,
  title text NOT NULL DEFAULT 'Camp updates',
  body text NOT NULL DEFAULT '',
  is_published boolean NOT NULL DEFAULT false,
  published_at timestamptz,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, season)
);

COMMENT ON TABLE public.parent_portal_camp_updates IS
  'Camp-wide bulletin for the parent portal home tab (one draft per company per season).';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.parent_portal_camp_updates TO authenticated;
GRANT ALL ON public.parent_portal_camp_updates TO service_role;

ALTER TABLE public.parent_portal_camp_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Staff manage parent portal camp updates" ON public.parent_portal_camp_updates;
CREATE POLICY "Staff manage parent portal camp updates"
  ON public.parent_portal_camp_updates
  FOR ALL
  TO authenticated
  USING (public.user_can_manage_parent_portal_data(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_parent_portal_data(auth.uid(), company_id));

DROP POLICY IF EXISTS "Parents read published camp updates" ON public.parent_portal_camp_updates;
CREATE POLICY "Parents read published camp updates"
  ON public.parent_portal_camp_updates
  FOR SELECT
  TO authenticated
  USING (
    is_published
    AND company_id IN (
      SELECT f.company_id
      FROM public.families f
      WHERE f.user_id = auth.uid()
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_parent_portal_camp_updates_updated_at'
      AND tgrelid = 'public.parent_portal_camp_updates'::regclass
  ) THEN
    CREATE TRIGGER trg_parent_portal_camp_updates_updated_at
      BEFORE UPDATE ON public.parent_portal_camp_updates
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_parent_portal_camp_updates_company_season
  ON public.parent_portal_camp_updates(company_id, season);
