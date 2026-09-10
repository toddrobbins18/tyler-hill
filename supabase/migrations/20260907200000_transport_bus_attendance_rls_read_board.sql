-- Bus attendance staff can read transport boards without write access to routing.

CREATE OR REPLACE FUNCTION public.user_can_read_transport_board(
  _user_id uuid,
  _company_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_can_manage_transport_board(_user_id, _company_id);
$$;

CREATE OR REPLACE FUNCTION public.user_can_take_bus_attendance(
  _user_id uuid,
  _company_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.user_can_read_transport_board(_user_id, _company_id);
$$;

DROP POLICY IF EXISTS "Users can manage transport boards" ON public.transport_boards;

CREATE POLICY "Users can read transport boards"
  ON public.transport_boards
  FOR SELECT
  TO authenticated
  USING (public.user_can_read_transport_board(auth.uid(), company_id));

CREATE POLICY "Users can manage transport boards"
  ON public.transport_boards
  FOR ALL
  TO authenticated
  USING (public.user_can_manage_transport_board(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_transport_board(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can manage transport bus attendance" ON public.transport_bus_attendance;

CREATE POLICY "Users can manage transport bus attendance"
  ON public.transport_bus_attendance
  FOR ALL
  TO authenticated
  USING (public.user_can_take_bus_attendance(auth.uid(), company_id))
  WITH CHECK (public.user_can_take_bus_attendance(auth.uid(), company_id));

DROP POLICY IF EXISTS "Users can manage transport bus checkins" ON public.transport_bus_checkins;

CREATE POLICY "Users can manage transport bus checkins"
  ON public.transport_bus_checkins
  FOR ALL
  TO authenticated
  USING (public.user_can_take_bus_attendance(auth.uid(), company_id))
  WITH CHECK (public.user_can_take_bus_attendance(auth.uid(), company_id));
