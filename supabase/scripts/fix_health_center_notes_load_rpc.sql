-- Run this if notes save but disappear on page refresh.
-- (Adds the load RPC; safe to run even if you already ran fix_health_center_notes_rls.sql)
--
-- NOTE: Testing list_health_center_admission_notes in SQL Editor returns 0 rows unless
-- you impersonate a user (auth.uid() is NULL in the dashboard). Use the diagnostics
-- at the bottom of this file instead.

-- Backfill notes missing company_id (RPC filters on company_id).
UPDATE public.health_center_admission_notes n
SET company_id = hca.company_id
FROM public.health_center_admissions hca
WHERE n.admission_id = hca.id
  AND n.company_id IS NULL
  AND hca.company_id IS NOT NULL;

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
DROP FUNCTION IF EXISTS public.list_health_center_admission_notes(uuid, text);
DROP FUNCTION IF EXISTS public.list_health_center_admission_notes(uuid, text, uuid[]);
DROP FUNCTION IF EXISTS public.list_health_center_admission_notes(uuid[], uuid);
DROP FUNCTION IF EXISTS public.list_health_center_admission_notes(uuid[], uuid, text);

-- PostgREST resolves RPC args in alphabetical order: _admission_ids, _company_id, _season.
-- Parameter order in the definition MUST match that.
CREATE OR REPLACE FUNCTION public.list_health_center_admission_notes(
  _admission_ids uuid[] DEFAULT NULL,
  _company_id uuid DEFAULT NULL,
  _season text DEFAULT NULL
)
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
  WHERE COALESCE(n.company_id, hca.company_id) = _company_id
    AND _company_id IS NOT NULL
    AND (_season IS NULL OR hca.season IS NULL OR hca.season = _season)
    AND (
      _admission_ids IS NULL
      OR cardinality(_admission_ids) = 0
      OR n.admission_id = ANY(_admission_ids)
    )
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

GRANT EXECUTE ON FUNCTION public.list_health_center_admission_notes(uuid[], uuid, text) TO authenticated;

DROP POLICY IF EXISTS "Staff can delete health center admission notes" ON public.health_center_admission_notes;
CREATE POLICY "Staff can delete health center admission notes"
  ON public.health_center_admission_notes
  FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.user_can_manage_health_center(auth.uid(), company_id)
  );

-- Diagnostics (run in SQL Editor):
--
-- 1) Notes exist + company_id set?
-- SELECT id, note, company_id, admission_id
-- FROM public.health_center_admission_notes
-- WHERE admission_id = '39271481-c8a0-4311-8671-4d60cfc8b6bc';
--
-- 2) Does YOUR user pass the permission check? (replace email)
-- SELECT u.email,
--   public.user_can_manage_health_center(u.id, '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid) AS can_manage
-- FROM auth.users u WHERE u.email = 'health@tylerhillcamp.com';
--
-- 3) RPC test requires impersonation (SQL Editor has no auth.uid()):
-- SELECT set_config('request.jwt.claim.sub', (SELECT id::text FROM auth.users WHERE email = 'health@tylerhillcamp.com'), true);
-- SELECT id, note FROM public.list_health_center_admission_notes(
--   ARRAY['39271481-c8a0-4311-8671-4d60cfc8b6bc']::uuid[],
--   '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid,
--   '2026'
-- );

NOTIFY pgrst, 'reload schema';
