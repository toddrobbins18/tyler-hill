-- Assign a Nest login to one bus (bus counselor scope).
-- Replace user id and bus label to match route board (e.g. "Bus 1", "1", "bus 1" all match).

-- UPDATE public.profiles
-- SET assigned_transport_bus = 'Bus 1'
-- WHERE id = '00000000-0000-0000-0000-000000000000';

-- Clear assignment (transport coordinator sees all routes if role has Transportation):
-- UPDATE public.profiles SET assigned_transport_bus = NULL WHERE id = '...';
