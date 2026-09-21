-- Swim bracelets + level reporting (per camper, per season; history via person_id).

CREATE TABLE IF NOT EXISTS public.swim_program_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  season text NOT NULL,
  person_id text,
  bracelet jsonb NOT NULL DEFAULT '{}'::jsonb,
  levels jsonb NOT NULL DEFAULT '{}'::jsonb,
  source text NOT NULL DEFAULT 'manual',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, child_id, season)
);

CREATE INDEX IF NOT EXISTS idx_swim_program_records_company_season
  ON public.swim_program_records (company_id, season);

CREATE INDEX IF NOT EXISTS idx_swim_program_records_person
  ON public.swim_program_records (company_id, person_id, season DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.swim_program_records TO authenticated;
GRANT ALL ON public.swim_program_records TO service_role;

ALTER TABLE public.swim_program_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Staff manage swim program records" ON public.swim_program_records;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Staff manage swim program records"
  ON public.swim_program_records
  FOR ALL
  USING (company_id = public.get_user_company(auth.uid()))
  WITH CHECK (company_id = public.get_user_company(auth.uid()));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'update_swim_program_records_updated_at'
      AND tgrelid = 'public.swim_program_records'::regclass
  ) THEN
    CREATE TRIGGER update_swim_program_records_updated_at
      BEFORE UPDATE ON public.swim_program_records
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

COMMENT ON TABLE public.swim_program_records IS
  'North Shore swim bracelets + skill levels. One row per camper per season; prior years via person_id.';
