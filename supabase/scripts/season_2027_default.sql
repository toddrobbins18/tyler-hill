-- Same as migration 20260821120000_season_2027_default.sql — run in Supabase SQL Editor first.

ALTER TABLE public.children
  ALTER COLUMN season SET DEFAULT '2027';

ALTER TABLE public.staff
  ALTER COLUMN season SET DEFAULT '2027';

ALTER TABLE public.sunshine_groups
  ADD COLUMN IF NOT EXISTS season text NOT NULL DEFAULT '2026';

ALTER TABLE public.sunshine_campers
  ADD COLUMN IF NOT EXISTS season text NOT NULL DEFAULT '2026';

ALTER TABLE public.sunshine_groups
  DROP CONSTRAINT IF EXISTS sunshine_groups_company_id_name_key;

DROP INDEX IF EXISTS public.sunshine_groups_company_name_season_unique;

CREATE UNIQUE INDEX sunshine_groups_company_name_season_unique
  ON public.sunshine_groups (company_id, name, season);

CREATE INDEX IF NOT EXISTS idx_sunshine_groups_company_season
  ON public.sunshine_groups (company_id, season);

CREATE INDEX IF NOT EXISTS idx_sunshine_campers_company_season
  ON public.sunshine_campers (company_id, season);

-- Then run: rollover_all_camps_2026_to_2027.sql
