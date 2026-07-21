-- Run once in Supabase SQL Editor (safe to re-run).
-- Fixes "Failed to create evaluation" for division leaders and head specialists.
--
-- 1) Ensures split-evaluation columns exist (ignores duplicate constraint error).
-- 2) Grants INSERT/UPDATE/SELECT on staff_evaluations + evaluation_responses for DL/specialist.

-- ── Schema (idempotent) ──────────────────────────────────────────────────────

ALTER TABLE public.staff_evaluations
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'complete',
ADD COLUMN IF NOT EXISTS dl_submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS dl_submitted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS head_specialist_submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS head_specialist_submitted_by UUID REFERENCES auth.users(id);

UPDATE public.staff_evaluations SET status = 'complete' WHERE status IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'evaluation_responses_evaluation_id_question_id_key'
      AND conrelid = 'public.evaluation_responses'::regclass
  ) THEN
    ALTER TABLE public.evaluation_responses
    ADD CONSTRAINT evaluation_responses_evaluation_id_question_id_key
    UNIQUE (evaluation_id, question_id);
  END IF;
END $$;

-- ── RLS: staff_evaluations ───────────────────────────────────────────────────

DROP POLICY IF EXISTS "Division leaders and specialists can manage staff evaluations"
  ON public.staff_evaluations;

CREATE POLICY "Division leaders and specialists can manage staff evaluations"
ON public.staff_evaluations
FOR ALL
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR (
    company_id = public.get_user_company(auth.uid())
    AND (
      public.has_role(auth.uid(), 'division_leader'::public.app_role)
      OR public.has_role(auth.uid(), 'specialist'::public.app_role)
      OR public.user_has_role_for_company(
        auth.uid(),
        company_id,
        ARRAY['division_leader', 'specialist']::public.app_role[]
      )
    )
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR (
    company_id = public.get_user_company(auth.uid())
    AND (
      public.has_role(auth.uid(), 'division_leader'::public.app_role)
      OR public.has_role(auth.uid(), 'specialist'::public.app_role)
      OR public.user_has_role_for_company(
        auth.uid(),
        company_id,
        ARRAY['division_leader', 'specialist']::public.app_role[]
      )
    )
  )
);

-- ── RLS: evaluation_responses ────────────────────────────────────────────────

DROP POLICY IF EXISTS "Division leaders and specialists can view evaluation responses"
  ON public.evaluation_responses;

CREATE POLICY "Division leaders and specialists can view evaluation responses"
ON public.evaluation_responses
FOR SELECT
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.staff_evaluations se
    WHERE se.id = evaluation_responses.evaluation_id
      AND se.company_id = public.get_user_company(auth.uid())
      AND (
        public.has_role(auth.uid(), 'division_leader'::public.app_role)
        OR public.has_role(auth.uid(), 'specialist'::public.app_role)
        OR public.user_has_role_for_company(
          auth.uid(),
          se.company_id,
          ARRAY['division_leader', 'specialist']::public.app_role[]
        )
      )
  )
);

DROP POLICY IF EXISTS "Division leaders and specialists can manage evaluation responses"
  ON public.evaluation_responses;

CREATE POLICY "Division leaders and specialists can manage evaluation responses"
ON public.evaluation_responses
FOR ALL
TO authenticated
USING (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.staff_evaluations se
    WHERE se.id = evaluation_responses.evaluation_id
      AND se.company_id = public.get_user_company(auth.uid())
      AND (
        public.has_role(auth.uid(), 'division_leader'::public.app_role)
        OR public.has_role(auth.uid(), 'specialist'::public.app_role)
        OR public.user_has_role_for_company(
          auth.uid(),
          se.company_id,
          ARRAY['division_leader', 'specialist']::public.app_role[]
        )
      )
  )
)
WITH CHECK (
  public.is_super_admin(auth.uid())
  OR EXISTS (
    SELECT 1
    FROM public.staff_evaluations se
    WHERE se.id = evaluation_responses.evaluation_id
      AND se.company_id = public.get_user_company(auth.uid())
      AND (
        public.has_role(auth.uid(), 'division_leader'::public.app_role)
        OR public.has_role(auth.uid(), 'specialist'::public.app_role)
        OR public.user_has_role_for_company(
          auth.uid(),
          se.company_id,
          ARRAY['division_leader', 'specialist']::public.app_role[]
        )
      )
  )
);

-- ── Verify ───────────────────────────────────────────────────────────────────

SELECT column_name
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'staff_evaluations'
  AND column_name IN ('status', 'dl_submitted_at', 'head_specialist_submitted_at')
ORDER BY column_name;

SELECT conname AS unique_constraint
FROM pg_constraint
WHERE conrelid = 'public.evaluation_responses'::regclass
  AND conname = 'evaluation_responses_evaluation_id_question_id_key';
