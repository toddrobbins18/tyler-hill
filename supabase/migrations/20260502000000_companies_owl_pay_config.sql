-- Per-company Owl Pay / financials configuration.
--
-- Why: the sync-campminder Edge function used to hardcode a single canteen
-- category id ("9076") and a single English-keyword fallback ("canteen",
-- "spending"). That belongs to Tyler Hill only, but the Owl Pay phase ran for
-- every company with `campminder_sync_enabled = true`, so Timber Lake Camp and
-- Timber Lake West were calling the financials endpoint with Tyler Hill's
-- category id and either matching nothing or matching the wrong rows.
--
-- This migration moves the configuration into the `companies` row so it is:
--   * gated per company (`owl_pay_enabled`)
--   * fully data-driven (category ids + description keywords come from the DB)
--
-- Tyler Hill is enabled in this migration with its current production values.
-- Other camps stay disabled until they (and their CampMinder admin) provide a
-- canteen / spending money category id.

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS owl_pay_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS campminder_owl_pay_category_ids text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS campminder_owl_pay_description_keywords text[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.companies.owl_pay_enabled IS
  'Enable CampMinder financials → Owl Pay balance sync for this company. When false, sync-campminder skips the financials phase entirely for the company.';
COMMENT ON COLUMN public.companies.campminder_owl_pay_category_ids IS
  'CampMinder financial category ids (as strings, e.g. "9076") that represent canteen / spending-money transactions for this camp. Any transaction whose FinancialCategoryId is in this list will be applied to children.owl_pay_balance.';
COMMENT ON COLUMN public.companies.campminder_owl_pay_description_keywords IS
  'Lowercase substrings to also match in the transaction Description field, as a fallback when CampMinder rows lack a clean category id. Empty array disables the fallback.';

-- Seed Tyler Hill with its existing production configuration so behavior is
-- unchanged for them after deploy. Other camps remain owl_pay_enabled = false
-- (the column default).
UPDATE public.companies
SET
  owl_pay_enabled = true,
  campminder_owl_pay_category_ids = ARRAY['9076'],
  campminder_owl_pay_description_keywords = ARRAY['canteen', 'spending']
WHERE name ILIKE '%tyler%hill%';
