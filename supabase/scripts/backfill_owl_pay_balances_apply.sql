-- APPLY ONLY after:
--   1. fix_owl_pay_campminder_reconciliation.sql has been run
--   2. sync-campminder edge function has been deployed
--   3. Dry run in backfill_owl_pay_balances_june27_today.sql looks correct

DO $$
DECLARE
  _company_id uuid;
  _admin_id uuid;
  r RECORD;
  _expected numeric;
  _correction numeric;
  _adjusted_count integer := 0;
  min_balance constant numeric := -25;
BEGIN
  SELECT id INTO _company_id FROM public.companies WHERE slug = 'tyler-hill-camp' LIMIT 1;
  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'Tyler Hill not found';
  END IF;

  SELECT id INTO _admin_id FROM auth.users LIMIT 1;

  FOR r IN
    WITH cm_totals AS (
      SELECT
        c.id AS child_id,
        COALESCE(SUM(ct.amount), 0) AS cm_deposit_total
      FROM public.children c
      LEFT JOIN public.campminder_transactions ct
        ON ct.company_id = c.company_id
       AND ct.person_id = c.person_id
      WHERE c.company_id = _company_id
        AND c.season = '2026'
        AND c.status IS DISTINCT FROM 'inactive'
      GROUP BY c.id
    ),
    spend_season AS (
      SELECT
        t.child_id,
        COALESCE(SUM(t.amount) FILTER (WHERE NOT COALESCE(t.is_free, false)), 0) AS owl_pay_spent
      FROM public.owl_pay_transactions t
      WHERE t.company_id = _company_id
        AND t.transaction_type = 'purchase'
        AND t.child_id IS NOT NULL
      GROUP BY t.child_id
    )
    SELECT
      c.id AS child_id,
      c.name,
      c.owl_pay_balance AS current_balance,
      GREATEST(COALESCE(cm.cm_deposit_total, 0) - COALESCE(ss.owl_pay_spent, 0), min_balance) AS expected_balance
    FROM public.children c
    LEFT JOIN cm_totals cm ON cm.child_id = c.id
    LEFT JOIN spend_season ss ON ss.child_id = c.id
    WHERE c.company_id = _company_id
      AND c.season = '2026'
      AND c.status IS DISTINCT FROM 'inactive'
      AND ABS(
        c.owl_pay_balance - GREATEST(COALESCE(cm.cm_deposit_total, 0) - COALESCE(ss.owl_pay_spent, 0), min_balance)
      ) > 0.01
  LOOP
    _expected := ROUND(r.expected_balance::numeric, 2);
    _correction := ROUND((r.current_balance - _expected)::numeric, 2);

    UPDATE public.children
    SET
      owl_pay_balance = _expected,
      updated_at = now()
    WHERE id = r.child_id;

    INSERT INTO public.owl_pay_transactions (
      company_id,
      child_id,
      amount,
      is_free,
      transaction_type,
      notes,
      created_by
    ) VALUES (
      _company_id,
      r.child_id,
      ABS(_correction),
      false,
      'adjustment',
      format(
        'System backfill: balance corrected from $%s to $%s (CM deposits minus Owl Pay purchases, Jun 27–Jul 7 2026)',
        ROUND(r.current_balance::numeric, 2),
        _expected
      ),
      _admin_id
    );

    _adjusted_count := _adjusted_count + 1;
    RAISE NOTICE 'Fixed %: $% -> $% (delta $%)',
      r.name, r.current_balance, _expected, _correction;
  END LOOP;

  RAISE NOTICE 'Backfill complete. Updated % camper balances.', _adjusted_count;
END;
$$;
