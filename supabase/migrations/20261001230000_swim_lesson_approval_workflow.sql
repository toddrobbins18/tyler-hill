-- Admin approve/reject swim lesson requests (phone-in or parent portal).

ALTER TABLE public.swim_lessons
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS reviewed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.swim_lessons.status IS
  'pending = awaiting admin approval; scheduled = approved; rejected = declined; cancelled = removed';

-- Existing rows were created by staff and should stay active.
UPDATE public.swim_lessons
SET status = 'scheduled'
WHERE status IS NULL OR status = '' OR status NOT IN ('pending', 'scheduled', 'rejected', 'cancelled');

DO $$ BEGIN
  DROP POLICY IF EXISTS "Parents request swim lessons" ON public.swim_lessons;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Parents request swim lessons"
  ON public.swim_lessons
  FOR INSERT TO authenticated
  WITH CHECK (
    status = 'pending'
    AND parent_confirmed = false
    AND transport_status IS NULL
    AND company_id IN (
      SELECT f.company_id FROM public.families f WHERE f.user_id = auth.uid()
    )
    AND camper_id IN (
      SELECT fc.child_id
      FROM public.family_children fc
      JOIN public.families f ON f.id = fc.family_id
      WHERE f.user_id = auth.uid()
    )
  );
