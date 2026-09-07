-- Daily group attendance (present / absent) per division/group and camper.

CREATE TABLE IF NOT EXISTS public.transport_group_attendance (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  season text NOT NULL,
  attendance_date date NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  submitted_at timestamptz,
  submitted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, season, attendance_date)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_group_attendance TO authenticated;
GRANT ALL ON public.transport_group_attendance TO service_role;

ALTER TABLE public.transport_group_attendance ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage transport group attendance" ON public.transport_group_attendance;

CREATE POLICY "Users can manage transport group attendance"
  ON public.transport_group_attendance
  FOR ALL
  TO authenticated
  USING (public.user_can_manage_transport_board(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_transport_board(auth.uid(), company_id));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_transport_group_attendance_updated_at'
      AND tgrelid = 'public.transport_group_attendance'::regclass
  ) THEN
    CREATE TRIGGER trg_transport_group_attendance_updated_at
      BEFORE UPDATE ON public.transport_group_attendance
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transport_group_attendance_lookup
  ON public.transport_group_attendance (company_id, season, attendance_date DESC);
