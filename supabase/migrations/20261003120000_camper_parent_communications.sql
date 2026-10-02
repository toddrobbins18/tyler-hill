-- Day camp: division leaders log phone calls, emails, and texts with parents on each camper profile.

CREATE TABLE IF NOT EXISTS public.camper_parent_communications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  season text NOT NULL,
  contact_date date NOT NULL DEFAULT CURRENT_DATE,
  contact_type text NOT NULL CHECK (contact_type IN ('phone', 'email', 'text')),
  notes text NOT NULL,
  logged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  logged_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.camper_parent_communications IS 'Parent contact log on day camp camper profiles (calls, emails, texts).';
COMMENT ON COLUMN public.camper_parent_communications.contact_type IS 'phone | email | text';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.camper_parent_communications TO authenticated;
GRANT ALL ON public.camper_parent_communications TO service_role;

ALTER TABLE public.camper_parent_communications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "camper_parent_communications_select" ON public.camper_parent_communications;
CREATE POLICY "camper_parent_communications_select"
  ON public.camper_parent_communications
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (
      company_id = public.get_user_company(auth.uid())
      AND public.can_access_child(child_id)
    )
  );

DROP POLICY IF EXISTS "camper_parent_communications_insert" ON public.camper_parent_communications;
CREATE POLICY "camper_parent_communications_insert"
  ON public.camper_parent_communications
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (
      company_id = public.get_user_company(auth.uid())
      AND public.can_access_child(child_id)
    )
  );

DROP POLICY IF EXISTS "camper_parent_communications_update" ON public.camper_parent_communications;
CREATE POLICY "camper_parent_communications_update"
  ON public.camper_parent_communications
  FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (
      company_id = public.get_user_company(auth.uid())
      AND public.can_access_child(child_id)
    )
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (
      company_id = public.get_user_company(auth.uid())
      AND public.can_access_child(child_id)
    )
  );

DROP POLICY IF EXISTS "camper_parent_communications_delete" ON public.camper_parent_communications;
CREATE POLICY "camper_parent_communications_delete"
  ON public.camper_parent_communications
  FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (
      company_id = public.get_user_company(auth.uid())
      AND public.can_access_child(child_id)
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_camper_parent_communications_updated_at'
      AND tgrelid = 'public.camper_parent_communications'::regclass
  ) THEN
    CREATE TRIGGER trg_camper_parent_communications_updated_at
      BEFORE UPDATE ON public.camper_parent_communications
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_camper_parent_communications_child
  ON public.camper_parent_communications(child_id, contact_date DESC);

CREATE INDEX IF NOT EXISTS idx_camper_parent_communications_company
  ON public.camper_parent_communications(company_id);
