-- Allow health center staff to edit admission notes (Todd #24).

ALTER TABLE public.health_center_admission_notes
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

DROP POLICY IF EXISTS "Staff can update health center admission notes" ON public.health_center_admission_notes;

CREATE POLICY "Staff can update health center admission notes"
  ON public.health_center_admission_notes
  FOR UPDATE
  USING (
    public.is_super_admin(auth.uid())
    OR (
      company_id = public.get_user_company(auth.uid())
      AND (
        public.has_role(auth.uid(), 'admin'::public.app_role)
        OR public.has_role(auth.uid(), 'staff'::public.app_role)
        OR public.has_role(auth.uid(), 'health_center'::public.app_role)
      )
    )
  )
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
