-- Diagnose health center admission notes (run in Supabase SQL Editor).

-- 1) Table exists?
SELECT EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public'
    AND table_name = 'health_center_admission_notes'
) AS notes_table_exists;

-- 2) Recent notes (service role / SQL editor sees all rows)
SELECT
  n.id,
  n.admission_id,
  n.company_id,
  co.name AS camp_name,
  n.note,
  n.created_at,
  c.name AS camper_name
FROM public.health_center_admission_notes n
LEFT JOIN public.companies co ON co.id = n.company_id
LEFT JOIN public.health_center_admissions hca ON hca.id = n.admission_id
LEFT JOIN public.children c ON c.id = hca.child_id
ORDER BY n.created_at DESC
LIMIT 30;

-- 3) Active policies on notes table
SELECT polname, polcmd, pg_get_expr(polqual, polrelid) AS using_expr
FROM pg_policy
WHERE polrelid = 'public.health_center_admission_notes'::regclass;

-- 4) Replace YOUR_USER_EMAIL and TYLER_HILL company id to test access helper
-- Tyler Hill: 0d0b7f4f-327e-4497-83ff-3aa501ffc295
SELECT
  u.email,
  p.company_id AS profile_company_id,
  ur.role,
  ur.company_id AS role_company_id,
  public.user_can_manage_health_center(u.id, '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid) AS can_manage_notes
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
LEFT JOIN public.user_roles ur ON ur.user_id = u.id
WHERE u.email ILIKE '%YOUR_USER_EMAIL%';
