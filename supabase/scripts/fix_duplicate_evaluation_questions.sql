-- Deactivate duplicate evaluation questions (keeps one row per company + question + staff type + evaluator + category).
-- Run in Supabase SQL Editor. Safe to re-run.

BEGIN;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        company_id,
        lower(trim(question_text)),
        coalesce(staff_type, ''),
        coalesce(evaluated_by, ''),
        coalesce(category, '')
      ORDER BY display_order NULLS LAST, created_at ASC, id ASC
    ) AS rn
  FROM public.evaluation_questions
  WHERE is_active = true
)
UPDATE public.evaluation_questions eq
SET is_active = false
FROM ranked r
WHERE eq.id = r.id
  AND r.rn > 1;

-- Preview what was deactivated (run separately if needed):
-- SELECT company_id, question_text, staff_type, evaluated_by, category, COUNT(*)
-- FROM evaluation_questions
-- WHERE is_active = true
-- GROUP BY 1, 2, 3, 4, 5
-- HAVING COUNT(*) > 1;

COMMIT;
