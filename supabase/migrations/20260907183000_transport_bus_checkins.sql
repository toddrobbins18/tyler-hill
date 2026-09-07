-- Daily bus check-in (supervisor confirms bus arrived) and check-out (ready to depart).

CREATE TABLE IF NOT EXISTS public.transport_bus_checkins (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  season text NOT NULL,
  check_date date NOT NULL,
  run_period text NOT NULL CHECK (run_period IN ('am', 'pm')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, season, check_date, run_period)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_bus_checkins TO authenticated;
GRANT ALL ON public.transport_bus_checkins TO service_role;

ALTER TABLE public.transport_bus_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage transport bus checkins" ON public.transport_bus_checkins;

CREATE POLICY "Users can manage transport bus checkins"
  ON public.transport_bus_checkins
  FOR ALL
  TO authenticated
  USING (public.user_can_manage_transport_board(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_transport_board(auth.uid(), company_id));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_transport_bus_checkins_updated_at'
      AND tgrelid = 'public.transport_bus_checkins'::regclass
  ) THEN
    CREATE TRIGGER trg_transport_bus_checkins_updated_at
      BEFORE UPDATE ON public.transport_bus_checkins
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transport_bus_checkins_lookup
  ON public.transport_bus_checkins (company_id, season, check_date DESC);
