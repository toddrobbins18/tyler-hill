-- Add tracking columns for split evaluations
ALTER TABLE public.staff_evaluations
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'complete',
ADD COLUMN IF NOT EXISTS dl_submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS dl_submitted_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS head_specialist_submitted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS head_specialist_submitted_by UUID REFERENCES auth.users(id);

-- Update existing records
UPDATE public.staff_evaluations SET status = 'complete' WHERE status IS NULL;

-- Add unique constraint to evaluation_responses to allow upsert (idempotent)
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
