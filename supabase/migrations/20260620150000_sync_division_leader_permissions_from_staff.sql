-- Ensure division_leader / viewer users inherit division_permissions from their staff.division_id.
-- Fixes roster access when staff are assigned to a division but division_permissions was never set
-- (e.g. hardylilly234@gmail.com / Teen Boys).

INSERT INTO public.division_permissions (user_id, division_id, company_id, can_access)
SELECT DISTINCT
  ur.user_id,
  d.id,
  d.company_id,
  true
FROM public.user_roles ur
JOIN public.profiles p ON p.id = ur.user_id
JOIN public.staff s
  ON s.company_id = p.company_id
 AND lower(trim(COALESCE(s.email, ''))) = lower(trim(COALESCE(p.email, '')))
 AND s.division_id IS NOT NULL
 AND COALESCE(s.status, 'active') = 'active'
JOIN public.divisions staff_div ON staff_div.id = s.division_id
JOIN public.divisions d
  ON d.company_id = staff_div.company_id
 AND d.is_active = true
 AND public.normalize_division_name_for_filter(d.name)
   = public.normalize_division_name_for_filter(staff_div.name)
WHERE ur.role IN ('division_leader'::public.app_role, 'viewer'::public.app_role)
ON CONFLICT (user_id, division_id)
DO UPDATE SET
  can_access = true,
  company_id = EXCLUDED.company_id;

-- Explicit fix for Lilly Hardy (Teen Boys division head) if staff email match missed a row.
INSERT INTO public.division_permissions (user_id, division_id, company_id, can_access)
SELECT
  u.id,
  d.id,
  d.company_id,
  true
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
JOIN public.divisions d
  ON d.company_id = p.company_id
 AND d.is_active = true
 AND public.normalize_division_name_for_filter(d.name) = 'teen boys'
WHERE lower(trim(u.email)) = 'hardylilly234@gmail.com'
ON CONFLICT (user_id, division_id)
DO UPDATE SET
  can_access = true,
  company_id = EXCLUDED.company_id;
