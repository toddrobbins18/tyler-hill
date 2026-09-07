-- Daily transport exceptions (today-only stop moves, exclusions) per camp + season + date.

CREATE TABLE IF NOT EXISTS public.transport_daily_overrides (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  season text NOT NULL,
  override_date date NOT NULL,
  data jsonb NOT NULL DEFAULT '{"excluded":{},"added":{}}'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, season, override_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_daily_overrides TO authenticated;
GRANT ALL ON public.transport_daily_overrides TO service_role;

ALTER TABLE public.transport_daily_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage transport daily overrides" ON public.transport_daily_overrides;

CREATE POLICY "Users can manage transport daily overrides"
  ON public.transport_daily_overrides
  FOR ALL
  TO authenticated
  USING (public.user_can_manage_transport_board(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_transport_board(auth.uid(), company_id));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_transport_daily_overrides_updated_at'
      AND tgrelid = 'public.transport_daily_overrides'::regclass
  ) THEN
    CREATE TRIGGER trg_transport_daily_overrides_updated_at
      BEFORE UPDATE ON public.transport_daily_overrides
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transport_daily_overrides_lookup
  ON public.transport_daily_overrides (company_id, season, override_date DESC);
