-- Day camp: optional live GPS from bus counselors while using the mobile app.

CREATE TABLE IF NOT EXISTS public.bus_route_live_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  season text NOT NULL,
  run_date date NOT NULL,
  time_of_day text NOT NULL CHECK (time_of_day IN ('am', 'pm')),
  route_id integer,
  bus_label text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_name text,
  latitude double precision NOT NULL,
  longitude double precision NOT NULL,
  accuracy_m double precision,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, user_id, run_date, time_of_day)
);

COMMENT ON TABLE public.bus_route_live_locations IS 'Latest GPS ping from staff sharing location on a bus run (foreground app only).';

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bus_route_live_locations TO authenticated;
GRANT ALL ON public.bus_route_live_locations TO service_role;

ALTER TABLE public.bus_route_live_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bus_route_live_locations_select" ON public.bus_route_live_locations;
CREATE POLICY "bus_route_live_locations_select"
  ON public.bus_route_live_locations
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR company_id = public.get_user_company(auth.uid())
  );

DROP POLICY IF EXISTS "bus_route_live_locations_insert" ON public.bus_route_live_locations;
CREATE POLICY "bus_route_live_locations_insert"
  ON public.bus_route_live_locations
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (company_id = public.get_user_company(auth.uid()) AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "bus_route_live_locations_update" ON public.bus_route_live_locations;
CREATE POLICY "bus_route_live_locations_update"
  ON public.bus_route_live_locations
  FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (company_id = public.get_user_company(auth.uid()) AND user_id = auth.uid())
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (company_id = public.get_user_company(auth.uid()) AND user_id = auth.uid())
  );

DROP POLICY IF EXISTS "bus_route_live_locations_delete" ON public.bus_route_live_locations;
CREATE POLICY "bus_route_live_locations_delete"
  ON public.bus_route_live_locations
  FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR (company_id = public.get_user_company(auth.uid()) AND user_id = auth.uid())
  );

CREATE INDEX IF NOT EXISTS idx_bus_route_live_locations_run
  ON public.bus_route_live_locations(company_id, run_date, time_of_day, updated_at DESC);
