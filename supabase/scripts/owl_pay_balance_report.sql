-- Owl Pay — current balance report (export to CSV for Todd / finance).
--
-- Run in Supabase SQL Editor → Results → Export CSV.
--
-- Columns explained:
--   cm_deposits        CampMinder canteen deposits
--   season_spent       Total paid Owl Pay purchases (season) — sum matches
--                      "Season revenue (campers)" in Owl Pay Reports when All Time + Campers
--   full_balance       Deposits minus spend (full accounting)
--   pos_balance        Stored owl_pay_balance (should match full_balance)
--   beyond_credit_cap  Headroom / sort key relative to -$75 credit limit
--
-- Last row is TOTALS — use season_spent total to reconcile with Owl Pay Reports.
-- Change season below if needed.

WITH camp AS (
  SELECT id AS company_id
  FROM public.companies
  WHERE slug = 'tyler-hill-camp'  -- change slug if another camp
  LIMIT 1
),
cm_deposits AS (
  SELECT
    c.id AS child_id,
    ROUND(COALESCE(SUM(ct.amount), 0)::numeric, 2) AS cm_deposits
  FROM public.children c
  JOIN camp ON c.company_id = camp.company_id
  LEFT JOIN public.campminder_transactions ct
    ON ct.company_id = c.company_id
   AND ct.person_id = c.person_id
  WHERE c.season = '2026'
    AND c.status IS DISTINCT FROM 'inactive'
  GROUP BY c.id
),
season_spend AS (
  SELECT
    t.child_id,
    ROUND(
      COALESCE(SUM(t.amount) FILTER (WHERE NOT COALESCE(t.is_free, false)), 0)::numeric,
      2
    ) AS season_spent,
    COUNT(*) FILTER (WHERE NOT COALESCE(t.is_free, false)) AS paid_items
  FROM public.owl_pay_transactions t
  JOIN camp ON t.company_id = camp.company_id
  WHERE t.transaction_type = 'purchase'
    AND t.child_id IS NOT NULL
  GROUP BY t.child_id
),
detail AS (
  SELECT
    c.person_id AS person_id,
    c.name AS camper_name,
    c.season,
    c.rfid,
    COALESCE(d.cm_deposits, 0) AS cm_deposits,
    COALESCE(s.season_spent, 0) AS season_spent,
    COALESCE(s.paid_items, 0) AS paid_items,
    ROUND((COALESCE(d.cm_deposits, 0) - COALESCE(s.season_spent, 0))::numeric, 2) AS full_balance,
    ROUND(c.owl_pay_balance::numeric, 2) AS pos_balance,
    ROUND(GREATEST((COALESCE(d.cm_deposits, 0) - COALESCE(s.season_spent, 0)) - (-75), 0)::numeric, 2) AS beyond_credit_cap,
    CASE
      WHEN ABS(
        c.owl_pay_balance - (COALESCE(d.cm_deposits, 0) - COALESCE(s.season_spent, 0))
      ) <= 0.01 THEN 'yes'
      ELSE 'no'
    END AS balance_matches_full_accounting
  FROM public.children c
  JOIN camp ON c.company_id = camp.company_id
  LEFT JOIN cm_deposits d ON d.child_id = c.id
  LEFT JOIN season_spend s ON s.child_id = c.id
  WHERE c.season = '2026'
    AND c.status IS DISTINCT FROM 'inactive'
)
SELECT
  person_id,
  camper_name,
  season,
  rfid,
  cm_deposits,
  season_spent,
  paid_items,
  full_balance,
  pos_balance,
  beyond_credit_cap,
  balance_matches_full_accounting
FROM (
  SELECT *, 0 AS _sort FROM detail
  UNION ALL
  SELECT
    NULL::text,
    'TOTALS',
    NULL::text,
    NULL::text,
    ROUND(SUM(cm_deposits)::numeric, 2),
    ROUND(SUM(season_spent)::numeric, 2),
    SUM(paid_items)::bigint,
    ROUND(SUM(full_balance)::numeric, 2),
    NULL::numeric,
    NULL::numeric,
    NULL::text,
    1 AS _sort
  FROM detail
) combined
ORDER BY
  _sort,
  beyond_credit_cap DESC NULLS LAST,
  full_balance ASC NULLS LAST,
  camper_name ASC;

-- Campers over the $75 credit cap only:
-- Wrap and filter: WHERE beyond_credit_cap > 0 AND camper_name <> 'TOTALS'
