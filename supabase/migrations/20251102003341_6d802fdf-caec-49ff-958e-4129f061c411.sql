-- Insert admin and super_admin roles for todd@camptlc.com
-- This bypasses RLS policies using service role privileges

INSERT INTO public.user_roles (user_id, role)
VALUES ('1550a549-9ffc-4dcc-a812-78d558012fc3', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

INSERT INTO public.user_roles (user_id, role)
VALUES ('1550a549-9ffc-4dcc-a812-78d558012fc3', 'super_admin')
ON CONFLICT (user_id, role) DO NOTHING;