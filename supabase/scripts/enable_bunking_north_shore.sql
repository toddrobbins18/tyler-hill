-- Enable Bunking for North Shore Day Camp + multi-camp RLS fix.
-- Run in Supabase SQL Editor (safe to re-run).

CREATE OR REPLACE FUNCTION public.user_can_manage_bunking_boards(
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

DROP POLICY IF EXISTS "Users can manage bunking boards" ON public.bunking_boards;

CREATE POLICY "Users can manage bunking boards"
  ON public.bunking_boards
  FOR ALL
  TO authenticated
  USING (public.user_can_manage_bunking_boards(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_bunking_boards(auth.uid(), company_id));

DO $$
DECLARE
  ns_company_id uuid;
BEGIN
  SELECT id INTO ns_company_id FROM public.companies WHERE slug = 'north-shore-day-camp';
  IF ns_company_id IS NULL THEN
    RAISE EXCEPTION 'north-shore-day-camp not found';
  END IF;

  INSERT INTO public.role_permissions (company_id, role, menu_item, can_access) VALUES
    (ns_company_id, 'admin', 'bunking', true),
    (ns_company_id, 'staff', 'bunking', true),
    (ns_company_id, 'division_leader', 'bunking', true)
  ON CONFLICT (company_id, role, menu_item) DO UPDATE SET can_access = EXCLUDED.can_access;
END $$;

SELECT rp.role, rp.menu_item, rp.can_access
FROM public.role_permissions rp
JOIN public.companies c ON c.id = rp.company_id
WHERE c.slug = 'north-shore-day-camp' AND rp.menu_item = 'bunking'
ORDER BY rp.role;
