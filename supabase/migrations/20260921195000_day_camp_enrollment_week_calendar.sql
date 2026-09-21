-- Configurable enrollment week calendar (weeks 1–8 → date ranges) per company/season.

CREATE TABLE IF NOT EXISTS public.day_camp_enrollment_weeks (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  season text NOT NULL,
  week_number integer NOT NULL CHECK (week_number >= 1 AND week_number <= 8),
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, season, week_number),
  CHECK (end_date >= start_date)
);

COMMENT ON TABLE public.day_camp_enrollment_weeks IS
  'Maps day camp enrollment weeks 1–8 to calendar date ranges for roster filtering and group bubble sheets.';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.day_camp_enrollment_weeks TO authenticated;
GRANT ALL ON public.day_camp_enrollment_weeks TO service_role;

ALTER TABLE public.day_camp_enrollment_weeks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage day camp enrollment weeks" ON public.day_camp_enrollment_weeks;

CREATE POLICY "Users can manage day camp enrollment weeks"
  ON public.day_camp_enrollment_weeks
  FOR ALL
  TO authenticated
  USING (public.user_can_manage_transport_board(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_transport_board(auth.uid(), company_id));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_day_camp_enrollment_weeks_updated_at'
      AND tgrelid = 'public.day_camp_enrollment_weeks'::regclass
  ) THEN
    CREATE TRIGGER trg_day_camp_enrollment_weeks_updated_at
      BEFORE UPDATE ON public.day_camp_enrollment_weeks
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_day_camp_enrollment_weeks_lookup
  ON public.day_camp_enrollment_weeks (company_id, season, week_number);
