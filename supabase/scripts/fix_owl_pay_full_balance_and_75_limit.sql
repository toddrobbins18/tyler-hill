-- Owl Pay: full balance display + $75 credit limit (Todd policy).
--
-- RUN IN SUPABASE SQL EDITOR (production):
--   1. This script (RPCs + one-time balance recalc)
--   2. Deploy sync-campminder edge function (uncapped reconciliation)
--   3. Deploy web + mobile app (OWL_PAY_MAX_OVERDRAFT = 75)
--
-- After this:
--   owl_pay_balance = CM deposits - season Owl Pay spend (FULL amount, e.g. -112)
--   New POS purchases blocked when balance would go below -$75

-- =============================================================================
-- 1) Ensure checkout + deposit RPCs use -$75 floor
-- =============================================================================

CREATE OR REPLACE FUNCTION public.increment_camper_balance(
  _child_id uuid,
  _amount numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance numeric;
  min_balance constant numeric := -75;
BEGIN
  UPDATE public.children
  SET owl_pay_balance = owl_pay_balance + _amount,
      updated_at = now()
  WHERE id = _child_id
    AND (owl_pay_balance + _amount) >= min_balance
  RETURNING owl_pay_balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'Owl Pay balance cannot go below -$75.00';
  END IF;

  RETURN new_balance;
END;
$$;

CREATE OR REPLACE FUNCTION public.complete_owl_pay_purchase(
  _company_id uuid,
  _child_id uuid,
  _staff_id uuid,
  _created_by uuid,
  _charge_total numeric,
  _record_free_daily_scan boolean,
  _transactions jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_balance numeric;
  min_balance constant numeric := -75;
  tx jsonb;
  applied_free boolean := false;
  camp_today date := (now() AT TIME ZONE 'America/New_York')::date;
BEGIN
  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'company_id is required';
  END IF;

  IF _child_id IS NULL AND _staff_id IS NULL THEN
    RAISE EXCEPTION 'child_id or staff_id is required';
  END IF;

  IF _child_id IS NOT NULL AND _staff_id IS NOT NULL THEN
    RAISE EXCEPTION 'Provide child_id or staff_id, not both';
  END IF;

  IF _record_free_daily_scan THEN
    IF _child_id IS NULL THEN
      RAISE EXCEPTION 'Free daily item applies to campers only';
    END IF;

    BEGIN
      INSERT INTO public.owl_pay_daily_scans (company_id, child_id, scan_date)
      VALUES (_company_id, _child_id, camp_today);
      applied_free := true;
    EXCEPTION
      WHEN unique_violation THEN
        RAISE EXCEPTION 'Free daily snack or drink already used today';
    END;
  END IF;

  IF _transactions IS NULL OR jsonb_typeof(_transactions) <> 'array' THEN
    RAISE EXCEPTION 'transactions payload must be a JSON array';
  END IF;

  FOR tx IN SELECT value FROM jsonb_array_elements(_transactions)
  LOOP
    INSERT INTO public.owl_pay_transactions (
      company_id,
      child_id,
      staff_id,
      item_id,
      amount,
      is_free,
      transaction_type,
      notes,
      created_by
    )
    VALUES (
      _company_id,
      NULLIF(tx->>'child_id', '')::uuid,
      NULLIF(tx->>'staff_id', '')::uuid,
      NULLIF(tx->>'item_id', '')::uuid,
      COALESCE((tx->>'amount')::numeric, 0),
      COALESCE((tx->>'is_free')::boolean, false),
      COALESCE(tx->>'transaction_type', 'purchase'),
      NULLIF(tx->>'notes', ''),
      NULLIF(tx->>'created_by', '')::uuid
    );
  END LOOP;

  IF _child_id IS NOT NULL AND COALESCE(_charge_total, 0) <> 0 THEN
    UPDATE public.children
    SET owl_pay_balance = owl_pay_balance - _charge_total,
        updated_at = now()
    WHERE id = _child_id
      AND company_id = _company_id
      AND (owl_pay_balance - _charge_total) >= min_balance
    RETURNING owl_pay_balance INTO new_balance;

    IF new_balance IS NULL THEN
      RAISE EXCEPTION 'Unable to update camper balance (camper not found or below -$75 credit limit)';
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'new_balance', new_balance,
    'charge_total', COALESCE(_charge_total, 0),
    'free_item_applied', applied_free
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.complete_owl_pay_purchase(
  uuid, uuid, uuid, uuid, numeric, boolean, jsonb
) TO authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.increment_camper_balance(uuid, numeric) TO authenticated, service_role;

-- =============================================================================
-- 2) Recalculate all 2026 camper balances = deposits - spend (FULL, uncapped)
-- =============================================================================

WITH th AS (
  SELECT id FROM public.companies WHERE slug = 'tyler-hill-camp' LIMIT 1
),
cm AS (
  SELECT
    c.id AS child_id,
    ROUND(COALESCE(SUM(ct.amount), 0)::numeric, 2) AS cm_deposits
  FROM public.children c
  JOIN th ON c.company_id = th.id
  LEFT JOIN public.campminder_transactions ct
    ON ct.company_id = c.company_id
   AND ct.person_id = c.person_id
  WHERE c.season = '2026'
    AND c.status IS DISTINCT FROM 'inactive'
  GROUP BY c.id
),
sp AS (
  SELECT
    t.child_id,
    ROUND(COALESCE(SUM(t.amount) FILTER (WHERE NOT COALESCE(t.is_free, false)), 0)::numeric, 2) AS season_spent
  FROM public.owl_pay_transactions t
  JOIN th ON t.company_id = th.id
  WHERE t.transaction_type = 'purchase'
    AND t.child_id IS NOT NULL
  GROUP BY t.child_id
),
targets AS (
  SELECT
    c.id AS child_id,
    ROUND((COALESCE(cm.cm_deposits, 0) - COALESCE(sp.season_spent, 0))::numeric, 2) AS full_balance
  FROM public.children c
  JOIN th ON c.company_id = th.id
  LEFT JOIN cm ON cm.child_id = c.id
  LEFT JOIN sp ON sp.child_id = c.id
  WHERE c.season = '2026'
    AND c.status IS DISTINCT FROM 'inactive'
)
UPDATE public.children c
SET owl_pay_balance = t.full_balance,
    updated_at = now()
FROM targets t
WHERE c.id = t.child_id
  AND ABS(c.owl_pay_balance - t.full_balance) > 0.01;

-- Verify (should return 0 mismatches):
-- SELECT COUNT(*) FROM ... (use owl_pay_balance_report.sql with pos_balance_matches_expected)
