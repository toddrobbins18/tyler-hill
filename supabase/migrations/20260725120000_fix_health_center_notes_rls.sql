-- Health center notes: fix multi-camp RLS (match medication_logs pattern).

CREATE TABLE IF NOT EXISTS public.health_center_admission_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES public.health_center_admissions(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.health_center_admission_notes
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_health_center_admission_notes_admission
  ON public.health_center_admission_notes(admission_id, created_at DESC);

ALTER TABLE public.health_center_admission_notes ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.health_center_admission_notes TO authenticated;

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

CREATE OR REPLACE FUNCTION public.user_can_manage_health_center_admissions(_user_id uuid, _company_id uuid)
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
      ARRAY['admin', 'health_center']::app_role[]
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
        OR public.has_role(_user_id, 'health_center'::app_role)
      )
    );
$$;

DROP POLICY IF EXISTS "Users can view health center admission notes" ON public.health_center_admission_notes;
CREATE POLICY "Users can view health center admission notes"
  ON public.health_center_admission_notes
  FOR SELECT
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.user_can_manage_health_center(auth.uid(), company_id)
    OR EXISTS (
      SELECT 1
      FROM public.health_center_admissions hca
      WHERE hca.id = admission_id
        AND public.user_can_manage_health_center(auth.uid(), hca.company_id)
        AND hca.child_id IS NOT NULL
        AND public.can_access_child(hca.child_id)
        AND (
          public.has_role(auth.uid(), 'division_leader'::app_role)
          OR public.has_role(auth.uid(), 'viewer'::app_role)
        )
    )
  );

DROP POLICY IF EXISTS "Staff can add health center admission notes" ON public.health_center_admission_notes;
CREATE POLICY "Staff can add health center admission notes"
  ON public.health_center_admission_notes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.user_can_manage_health_center(auth.uid(), company_id)
  );

DROP POLICY IF EXISTS "Staff can update health center admission notes" ON public.health_center_admission_notes;
CREATE POLICY "Staff can update health center admission notes"
  ON public.health_center_admission_notes
  FOR UPDATE
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.user_can_manage_health_center(auth.uid(), company_id)
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.user_can_manage_health_center(auth.uid(), company_id)
  );

DROP POLICY IF EXISTS "Health center and admins can manage health admissions" ON public.health_center_admissions;
CREATE POLICY "Health center and admins can manage health admissions"
  ON public.health_center_admissions
  FOR ALL
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.user_can_manage_health_center_admissions(auth.uid(), company_id)
  )
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR public.user_can_manage_health_center_admissions(auth.uid(), company_id)
  );

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
