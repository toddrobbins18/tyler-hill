-- Daily bus attendance (present / absent) per route, camper, date, and AM/PM run.

CREATE TABLE IF NOT EXISTS public.transport_bus_attendance (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  season text NOT NULL,
  attendance_date date NOT NULL,
  run_period text NOT NULL CHECK (run_period IN ('am', 'pm')),
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, season, attendance_date, run_period)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_bus_attendance TO authenticated;
GRANT ALL ON public.transport_bus_attendance TO service_role;

ALTER TABLE public.transport_bus_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage transport bus attendance" ON public.transport_bus_attendance;

CREATE POLICY "Users can manage transport bus attendance"
  ON public.transport_bus_attendance
  FOR ALL
  TO authenticated
  USING (public.user_can_manage_transport_board(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_transport_board(auth.uid(), company_id));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_transport_bus_attendance_updated_at'
      AND tgrelid = 'public.transport_bus_attendance'::regclass
  ) THEN
    CREATE TRIGGER trg_transport_bus_attendance_updated_at
      BEFORE UPDATE ON public.transport_bus_attendance
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transport_bus_attendance_lookup
  ON public.transport_bus_attendance (company_id, season, attendance_date DESC);
