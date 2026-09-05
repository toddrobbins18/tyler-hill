-- Day camp bus transport board (routes, stops, unplotted campers) per camp + season.

CREATE TABLE IF NOT EXISTS public.transport_boards (
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  season text NOT NULL DEFAULT '2027',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (company_id, season)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.transport_boards TO authenticated;
GRANT ALL ON public.transport_boards TO service_role;

ALTER TABLE public.transport_boards ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_can_manage_transport_board(
  _user_id uuid,
  _company_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id)
    OR _company_id = public.get_user_company(_user_id)
    OR public.user_has_role_for_company(
      _user_id,
      _company_id,
      ARRAY['admin', 'staff', 'division_leader']::public.app_role[]
    );
$$;

DROP POLICY IF EXISTS "Users can manage transport boards" ON public.transport_boards;

CREATE POLICY "Users can manage transport boards"
  ON public.transport_boards
  FOR ALL
  TO authenticated
  USING (public.user_can_manage_transport_board(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_transport_board(auth.uid(), company_id));

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'trg_transport_boards_updated_at'
      AND tgrelid = 'public.transport_boards'::regclass
  ) THEN
    CREATE TRIGGER trg_transport_boards_updated_at
      BEFORE UPDATE ON public.transport_boards
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transport_boards_company_season
  ON public.transport_boards (company_id, season);
