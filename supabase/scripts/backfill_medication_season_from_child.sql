-- Optional: find medication rows saved under the wrong season (common before mobile season fix).
-- Review results before running the UPDATE.

SELECT ml.id,
       ml.medication_name,
       ml.season AS med_season,
       c.season AS child_season,
       c.name,
       ml.created_at
FROM public.medication_logs ml
JOIN public.children c ON c.id = ml.child_id
WHERE ml.company_id = c.company_id
  AND ml.season IS DISTINCT FROM c.season
ORDER BY ml.created_at DESC
LIMIT 100;

-- After review, align medication season with the camper's roster season:
-- UPDATE public.medication_logs ml
-- SET season = c.season
-- FROM public.children c
-- WHERE ml.child_id = c.id
--   AND ml.company_id = c.company_id
--   AND ml.season IS DISTINCT FROM c.season;
