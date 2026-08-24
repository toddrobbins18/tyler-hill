-- Link Sunshine campers to Nest roster for group_name (FULLSUMMERGROUP) sync.

ALTER TABLE public.sunshine_campers
  ADD COLUMN IF NOT EXISTS child_id uuid REFERENCES public.children(id) ON DELETE CASCADE;

CREATE UNIQUE INDEX IF NOT EXISTS sunshine_campers_company_season_child_unique
  ON public.sunshine_campers (company_id, season, child_id)
  WHERE child_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sunshine_campers_child_id
  ON public.sunshine_campers (child_id)
  WHERE child_id IS NOT NULL;
