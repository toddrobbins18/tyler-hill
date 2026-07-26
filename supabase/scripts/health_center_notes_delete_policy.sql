-- Allow health center staff to delete follow-up admission notes.

DROP POLICY IF EXISTS "Staff can delete health center admission notes" ON public.health_center_admission_notes;

CREATE POLICY "Staff can delete health center admission notes"
  ON public.health_center_admission_notes
  FOR DELETE
  TO authenticated
  USING (
    public.is_super_admin(auth.uid())
    OR public.user_can_manage_health_center(auth.uid(), company_id)
  );
