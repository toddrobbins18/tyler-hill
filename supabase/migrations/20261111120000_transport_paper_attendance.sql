-- Old School attendance: scanned bus + group bubble sheets, reviewed before change sheets.

CREATE TABLE IF NOT EXISTS public.transport_paper_attendance (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  season text NOT NULL,
  attendance_date date NOT NULL,
  list_kind text NOT NULL CHECK (list_kind IN ('bus', 'group')),
  sheet_label text NOT NULL,
  run_period text NOT NULL DEFAULT 'day',
  absents jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, season, attendance_date, list_kind, sheet_label, run_period)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_paper_attendance TO authenticated;
GRANT ALL ON public.transport_paper_attendance TO service_role;

ALTER TABLE public.transport_paper_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage transport paper attendance" ON public.transport_paper_attendance;

CREATE POLICY "Users can manage transport paper attendance"
  ON public.transport_paper_attendance
  FOR ALL
  TO authenticated
  USING (public.user_can_manage_transport_board(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_transport_board(auth.uid(), company_id));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_transport_paper_attendance_updated_at'
      AND tgrelid = 'public.transport_paper_attendance'::regclass
  ) THEN
    CREATE TRIGGER trg_transport_paper_attendance_updated_at
      BEFORE UPDATE ON public.transport_paper_attendance
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transport_paper_attendance_lookup
  ON public.transport_paper_attendance (company_id, season, attendance_date DESC);
