-- Owl Pay balance backfill for Tyler Hill Camp.
--
-- Sets owl_pay_balance = CampMinder deposits - Owl Pay purchases (floor -$25).
-- Does NOT duplicate purchase rows; only corrects balances + optional adjustment audit rows.
--
-- RUN ORDER:
--   1. fix_owl_pay_campminder_reconciliation.sql  (RPC helper)
--   2. Deploy sync-campminder edge function
--   3. PART 1 below (dry run) — review totals
--   4. PART 2 below (apply) — only after sync fix is live
--
-- Expected dry-run totals (Jul 7 2026): ~587 campers, ~$4606 over-credited, ~$118 under-credited.

-- =============================================================================
-- PART 1: DRY RUN (read-only)
-- =============================================================================

WITH th AS (
  SELECT id FROM public.companies WHERE slug = 'tyler-hill-camp' LIMIT 1
),
cm_totals AS (
  SELECT
    c.id AS child_id,
    ROUND(COALESCE(SUM(ct.amount), 0)::numeric, 2) AS cm_deposit_total
  FROM public.children c
  JOIN th ON c.company_id = th.id
  LEFT JOIN public.campminder_transactions ct
    ON ct.company_id = c.company_id
   AND ct.person_id = c.person_id
  WHERE c.season = '2026'
    AND c.status IS DISTINCT FROM 'inactive'
  GROUP BY c.id
),
spend_season AS (
  SELECT
    t.child_id,
    ROUND(COALESCE(SUM(t.amount) FILTER (WHERE NOT COALESCE(t.is_free, false)), 0)::numeric, 2) AS owl_pay_spent
  FROM public.owl_pay_transactions t
  JOIN th ON t.company_id = th.id
  WHERE t.transaction_type = 'purchase'
    AND t.child_id IS NOT NULL
  GROUP BY t.child_id
),
targets AS (
  SELECT
    c.id AS child_id,
    c.name,
    ROUND(c.owl_pay_balance::numeric, 2) AS current_balance,
    COALESCE(cm.cm_deposit_total, 0) AS cm_deposit_total,
    COALESCE(ss.owl_pay_spent, 0) AS owl_pay_spent,
    ROUND(GREATEST(COALESCE(cm.cm_deposit_total, 0) - COALESCE(ss.owl_pay_spent, 0), -25)::numeric, 2) AS expected_balance
  FROM public.children c
  JOIN th ON c.company_id = th.id
  LEFT JOIN cm_totals cm ON cm.child_id = c.id
  LEFT JOIN spend_season ss ON ss.child_id = c.id
  WHERE c.season = '2026'
    AND c.status IS DISTINCT FROM 'inactive'
    AND ABS(
      c.owl_pay_balance - GREATEST(COALESCE(cm.cm_deposit_total, 0) - COALESCE(ss.owl_pay_spent, 0), -25)
    ) > 0.01
)
SELECT
  COUNT(*) AS campers_to_fix,
  ROUND(SUM(GREATEST(current_balance - expected_balance, 0))::numeric, 2) AS total_over_credited_dollars,
  ROUND(SUM(GREATEST(expected_balance - current_balance, 0))::numeric, 2) AS total_under_credited_dollars
FROM targets;

-- Detail (top 50 by correction size):
-- SELECT name, current_balance, expected_balance, owl_pay_spent,
--        ROUND((current_balance - expected_balance)::numeric, 2) AS correction
-- FROM targets
-- ORDER BY ABS(current_balance - expected_balance) DESC, name
-- LIMIT 50;


-- Apply script: backfill_owl_pay_balances_apply.sql (run after sync fix is deployed)
