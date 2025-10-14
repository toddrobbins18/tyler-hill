-- Insert first admin user bypassing RLS
-- This is necessary to bootstrap the admin system
INSERT INTO public.user_roles (user_id, role)
VALUES ('1550a549-9ffc-4dcc-a812-78d558012fc3', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;