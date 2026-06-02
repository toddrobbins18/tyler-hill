-- Additional notes on health center admissions (multiple per stay)
CREATE TABLE IF NOT EXISTS public.health_center_admission_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admission_id UUID NOT NULL REFERENCES public.health_center_admissions(id) ON DELETE CASCADE,
  company_id UUID REFERENCES public.companies(id) ON DELETE CASCADE,
  note TEXT NOT NULL,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_center_admission_notes_admission
  ON public.health_center_admission_notes(admission_id, created_at DESC);

ALTER TABLE public.health_center_admission_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view health center admission notes" ON public.health_center_admission_notes;
CREATE POLICY "Users can view health center admission notes"
  ON public.health_center_admission_notes FOR SELECT
  USING (
    public.is_super_admin(auth.uid())
    OR company_id = public.get_user_company(auth.uid())
  );

DROP POLICY IF EXISTS "Staff can add health center admission notes" ON public.health_center_admission_notes;
CREATE POLICY "Staff can add health center admission notes"
  ON public.health_center_admission_notes FOR INSERT
  WITH CHECK (
    public.is_super_admin(auth.uid())
    OR (
      company_id = public.get_user_company(auth.uid())
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'staff'::public.app_role)
        OR public.has_role(auth.uid(), 'health_center'::public.app_role)
      )
    )
  );
