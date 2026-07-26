-- Run this if notes save but disappear on page refresh.
-- (Adds the load RPC; safe to run even if you already ran fix_health_center_notes_rls.sql)

CREATE OR REPLACE FUNCTION public.user_can_manage_health_center(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id)
    OR public.user_has_role_for_company(
      _user_id,
      _company_id,
      ARRAY['admin', 'staff', 'health_center']::app_role[]
    )
    OR (
      (
        _company_id = public.get_user_company(_user_id)
        OR _company_id = (
          SELECT p.company_id FROM public.profiles p WHERE p.id = _user_id LIMIT 1
        )
      )
      AND (
        public.has_role(_user_id, 'admin'::app_role)
        OR public.has_role(_user_id, 'staff'::app_role)
        OR public.has_role(_user_id, 'health_center'::app_role)
      )
    );
$$;

DROP FUNCTION IF EXISTS public.list_health_center_admission_notes(uuid);

CREATE OR REPLACE FUNCTION public.list_health_center_admission_notes(_company_id uuid)
RETURNS TABLE (
  id uuid,
  admission_id uuid,
  child_id uuid,
  staff_id uuid,
  season text,
  note text,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    n.id,
    n.admission_id,
    hca.child_id,
    hca.staff_id,
    hca.season,
    n.note,
    n.created_at,
    n.updated_at
  FROM public.health_center_admission_notes n
  JOIN public.health_center_admissions hca ON hca.id = n.admission_id
  WHERE n.company_id = _company_id
    AND (
      public.is_super_admin(auth.uid())
      OR public.user_can_manage_health_center(auth.uid(), _company_id)
      OR EXISTS (
        SELECT 1
        FROM public.health_center_admissions hca2
        WHERE hca2.id = n.admission_id
          AND hca2.company_id = _company_id
          AND hca2.child_id IS NOT NULL
          AND public.can_access_child(hca2.child_id)
          AND (
            public.has_role(auth.uid(), 'division_leader'::app_role)
            OR public.has_role(auth.uid(), 'viewer'::app_role)
          )
      )
    )
  ORDER BY n.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.list_health_center_admission_notes(uuid) TO authenticated;

-- Test (replace with Tyler Hill company id):
-- SELECT * FROM public.list_health_center_admission_notes('0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid);
