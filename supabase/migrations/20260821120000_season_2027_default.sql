-- Season 2027: defaults for new camper/staff rows + Sunshine Report season scoping.
-- Does NOT modify existing 2026 rows. Run rollover_all_camps_2026_to_2027.sql after this.

-- New inserts default to 2027
ALTER TABLE public.children
  ALTER COLUMN season SET DEFAULT '2027';

ALTER TABLE public.staff
  ALTER COLUMN season SET DEFAULT '2027';

-- Sunshine Report: scope groups/campers by season (existing rows stay 2026)
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

COMMENT ON COLUMN public.sunshine_groups.season IS 'Camp season year; 2026 historical + 2027 active after rollover.';
COMMENT ON COLUMN public.sunshine_campers.season IS 'Camp season year; 2026 historical + 2027 active after rollover.';
