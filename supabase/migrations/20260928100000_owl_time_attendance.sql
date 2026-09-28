-- Owl Time season calendar + attendance report settings (day camps only).

CREATE TABLE IF NOT EXISTS public.owl_time_season_settings (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  season text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  expected_sign_in_time time NOT NULL DEFAULT '08:30:00',
  expected_sign_out_time time NOT NULL DEFAULT '16:00:00',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, season),
  CHECK (end_date >= start_date)
);

COMMENT ON TABLE public.owl_time_season_settings IS
  'Per-season Owl Time calendar bounds and on-time / early-departure thresholds.';

CREATE TABLE IF NOT EXISTS public.owl_time_closed_dates (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  season text NOT NULL,
  closed_date date NOT NULL,
  label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, season, closed_date),
  FOREIGN KEY (company_id, season)
    REFERENCES public.owl_time_season_settings (company_id, season)
    ON DELETE CASCADE
);

COMMENT ON TABLE public.owl_time_closed_dates IS
  'Camp-closed weekdays within an Owl Time season (holidays, weather days, etc.).';

CREATE INDEX IF NOT EXISTS idx_owl_time_closed_dates_lookup
  ON public.owl_time_closed_dates (company_id, season, closed_date);

ALTER TABLE public.owl_time_season_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.owl_time_closed_dates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View owl time settings for day camp companies" ON public.owl_time_season_settings;
DROP POLICY IF EXISTS "Manage owl time settings for day camp companies" ON public.owl_time_season_settings;
DROP POLICY IF EXISTS "View owl time closed dates for day camp companies" ON public.owl_time_closed_dates;
DROP POLICY IF EXISTS "Manage owl time closed dates for day camp companies" ON public.owl_time_closed_dates;

CREATE POLICY "View owl time settings for day camp companies"
  ON public.owl_time_season_settings
  FOR SELECT
  TO authenticated
  USING (
    public.company_is_day_camp(company_id)
    AND public.user_can_view_od_company_data(auth.uid(), company_id)
  );

CREATE POLICY "Manage owl time settings for day camp companies"
  ON public.owl_time_season_settings
  FOR ALL
  TO authenticated
  USING (
    public.company_is_day_camp(company_id)
    AND public.user_can_manage_od_data(auth.uid(), company_id)
  )
  WITH CHECK (
    public.company_is_day_camp(company_id)
    AND public.user_can_manage_od_data(auth.uid(), company_id)
  );

CREATE POLICY "View owl time closed dates for day camp companies"
  ON public.owl_time_closed_dates
  FOR SELECT
  TO authenticated
  USING (
    public.company_is_day_camp(company_id)
    AND public.user_can_view_od_company_data(auth.uid(), company_id)
  );

CREATE POLICY "Manage owl time closed dates for day camp companies"
  ON public.owl_time_closed_dates
  FOR ALL
  TO authenticated
  USING (
    public.company_is_day_camp(company_id)
    AND public.user_can_manage_od_data(auth.uid(), company_id)
  )
  WITH CHECK (
    public.company_is_day_camp(company_id)
    AND public.user_can_manage_od_data(auth.uid(), company_id)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.owl_time_season_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.owl_time_closed_dates TO authenticated;
GRANT ALL ON public.owl_time_season_settings TO service_role;
GRANT ALL ON public.owl_time_closed_dates TO service_role;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_owl_time_season_settings_updated_at'
      AND tgrelid = 'public.owl_time_season_settings'::regclass
  ) THEN
    CREATE TRIGGER trg_owl_time_season_settings_updated_at
      BEFORE UPDATE ON public.owl_time_season_settings
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;
