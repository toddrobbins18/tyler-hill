-- Optional bus assignment for counselors (Bus 1 counselor sees only Bus 1 attendance).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS assigned_transport_bus text;

COMMENT ON COLUMN public.profiles.assigned_transport_bus IS
  'When set (e.g. Bus 1), staff with bus-attendance only see that bus. Admins and transport managers see all buses.';
