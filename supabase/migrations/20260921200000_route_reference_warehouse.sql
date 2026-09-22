-- Historical MapPoint route reference warehouse (training / lookup dataset).

CREATE TABLE IF NOT EXISTS public.route_reference_imports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reference_season text NOT NULL,
  source text NOT NULL DEFAULT 'mappoint',
  label text,
  imported_at timestamptz NOT NULL DEFAULT now(),
  imported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  stats jsonb NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (company_id, reference_season, source)
);

COMMENT ON TABLE public.route_reference_imports IS
  'Metadata for a MapPoint (or other) historical route import used as routing reference data.';

CREATE TABLE IF NOT EXISTS public.route_reference_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id uuid NOT NULL REFERENCES public.route_reference_imports(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  reference_season text NOT NULL,
  route_file text NOT NULL,
  bus_number integer NOT NULL,
  route_name text NOT NULL,
  direction text NOT NULL CHECK (direction IN ('AM', 'PM')),
  stop_order integer NOT NULL,
  camper_name text NOT NULL,
  camper_name_key text NOT NULL,
  street text,
  city text,
  zip text,
  address text NOT NULL,
  lat double precision,
  lng double precision,
  geocode_provider text,
  bus_counselor text,
  created_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.route_reference_assignments IS
  'One row per camper stop assignment from historical MapPoint exports (reference routing dataset).';

CREATE INDEX IF NOT EXISTS idx_route_reference_imports_company
  ON public.route_reference_imports (company_id, reference_season DESC);

CREATE INDEX IF NOT EXISTS idx_route_reference_assignments_company_season
  ON public.route_reference_assignments (company_id, reference_season, direction);

CREATE INDEX IF NOT EXISTS idx_route_reference_assignments_camper
  ON public.route_reference_assignments (company_id, camper_name_key, reference_season DESC);

CREATE INDEX IF NOT EXISTS idx_route_reference_assignments_bus_order
  ON public.route_reference_assignments (company_id, reference_season, bus_number, direction, stop_order);

CREATE INDEX IF NOT EXISTS idx_route_reference_assignments_import
  ON public.route_reference_assignments (import_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_reference_imports TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_reference_assignments TO authenticated;
GRANT ALL ON public.route_reference_imports TO service_role;
GRANT ALL ON public.route_reference_assignments TO service_role;

ALTER TABLE public.route_reference_imports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_reference_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage route reference imports" ON public.route_reference_imports;
DROP POLICY IF EXISTS "Users can manage route reference assignments" ON public.route_reference_assignments;

CREATE POLICY "Users can manage route reference imports"
  ON public.route_reference_imports
  FOR ALL
  TO authenticated
  USING (public.user_can_manage_transport_board(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_transport_board(auth.uid(), company_id));

CREATE POLICY "Users can manage route reference assignments"
  ON public.route_reference_assignments
  FOR ALL
  TO authenticated
  USING (public.user_can_manage_transport_board(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_transport_board(auth.uid(), company_id));

-- Read-only access for staff who can view the transport board (same as bus attendance read).
DROP POLICY IF EXISTS "Users can read route reference imports" ON public.route_reference_imports;
DROP POLICY IF EXISTS "Users can read route reference assignments" ON public.route_reference_assignments;

CREATE POLICY "Users can read route reference imports"
  ON public.route_reference_imports
  FOR SELECT
  TO authenticated
  USING (public.user_can_read_transport_board(auth.uid(), company_id));

CREATE POLICY "Users can read route reference assignments"
  ON public.route_reference_assignments
  FOR SELECT
  TO authenticated
  USING (public.user_can_read_transport_board(auth.uid(), company_id));
