-- Debug one user (Gulbaz / any division leader) — run in Supabase SQL Editor

-- 1) Current INSERT policy (must use user_can_create_incident_reports, NOT user_can_manage only)
SELECT policyname, cmd, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'incident_reports'
  AND cmd = 'INSERT';

-- 2) Gulbaz account
SELECT
  p.id,
  p.email,
  p.role AS profile_role,
  p.company_id,
  p.approved,
  ur.role AS login_role,
  ur.company_id AS login_company_id
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
WHERE p.email = 'gulbazkachoo3032@gmail.com';

-- 3) Permission checks for Tyler Hill (replace company_id if different)
SELECT
  public.user_can_create_incident_reports(
    '8ca3e242-bd72-4f42-aa8f-5c9fa29a20e4'::uuid,
    '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  ) AS can_create,
  public.user_can_view_all_company_incidents(
    '8ca3e242-bd72-4f42-aa8f-5c9fa29a20e4'::uuid,
    '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  ) AS can_view_all,
  public.user_can_manage_incidents(
    '8ca3e242-bd72-4f42-aa8f-5c9fa29a20e4'::uuid,
    '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  ) AS can_manage_delete_only;

-- 3b) Can edit a recent Tyler Hill incident (run 02e if false for DL)
SELECT ir.id, ir.type, public.can_edit_incident_report(ir.id) AS can_edit
FROM public.incident_reports ir
WHERE ir.company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
ORDER BY ir.created_at DESC NULLS LAST
LIMIT 5;

-- 4) Division permissions (needed to link campers after insert)
SELECT d.name AS division_name, dp.can_access
FROM public.division_permissions dp
JOIN public.divisions d ON d.id = dp.division_id
WHERE dp.user_id = '8ca3e242-bd72-4f42-aa8f-5c9fa29a20e4'::uuid
ORDER BY d.name;

-- If can_create=true but app still fails → run 02d_apply_incident_policies_only.sql
-- If edit fails for DL → run 02e_allow_dl_edit_incidents.sql
-- If can_create=false → fix user_roles / division_leader row for Tyler Hill
