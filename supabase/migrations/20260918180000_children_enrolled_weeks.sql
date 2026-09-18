-- Day camp: enrolled weeks 1–8 per camper (FULL = all eight weeks).

ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS enrolled_weeks integer[];

COMMENT ON COLUMN public.children.enrolled_weeks IS
  'Day camp enrollment weeks 1–8. Full summer = {1,2,3,4,5,6,7,8}. Populated by CampMinder sync from session enrollments.';
