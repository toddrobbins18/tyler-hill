-- Todd: bus counselors — Nest limited to paperless bus attendance for one assigned bus.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS bus_attendance_only boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.bus_attendance_only IS
  'When true (and assigned_transport_bus set), user sees only Bus Attendance / Bus Check-Ins in Nest for that bus.';

COMMENT ON COLUMN public.profiles.assigned_transport_bus IS
  'Bus label (e.g. Bus 1). Required when bus_attendance_only is true. Admins and transport managers ignore this for full access.';

CREATE OR REPLACE FUNCTION public.set_bus_counselor_access(
  _user_id uuid,
  _bus_attendance_only boolean,
  _assigned_bus text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_company uuid;
  caller uuid := auth.uid();
  bus text := NULLIF(trim(_assigned_bus), '');
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT company_id INTO target_company FROM public.profiles WHERE id = _user_id;
  IF target_company IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF NOT is_super_admin(caller) THEN
    IF NOT (
      (
        has_role(caller, 'admin'::app_role)
        AND (
          target_company = get_user_company(caller)
          OR get_user_company(caller) IS NULL
        )
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.role_permissions rp
          ON rp.company_id = ur.company_id
         AND rp.role = ur.role
         AND rp.menu_item = 'transport-admin'
         AND rp.can_access = true
        WHERE ur.user_id = caller
          AND ur.company_id = target_company
      )
    ) THEN
      RAISE EXCEPTION 'Not allowed to manage bus counselor access';
    END IF;
  END IF;

  IF _bus_attendance_only AND bus IS NULL THEN
    RAISE EXCEPTION 'Choose a bus when bus attendance only is enabled';
  END IF;

  UPDATE public.profiles
  SET
    bus_attendance_only = _bus_attendance_only,
    assigned_transport_bus = CASE WHEN _bus_attendance_only THEN bus ELSE NULL END,
    updated_at = now()
  WHERE id = _user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_bus_counselor_access(uuid, boolean, text) TO authenticated;
