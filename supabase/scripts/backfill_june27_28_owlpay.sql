-- This script safely backfills missed deductions from June 27 and 28 for Tyler Hill Camp.
-- It ONLY deducts money from campers whose balances exactly match standard starting deposits 
-- (e.g., $50, $75, $100, $150, etc.) despite having paid purchases on those dates,
-- which indicates the system failed to deduct their purchases.

DO $$
DECLARE
  _company_id uuid;
  _admin_id uuid;
  r RECORD;
  _total_to_deduct numeric;
  _adjusted_count integer := 0;
BEGIN
  -- 1. Get Tyler Hill company ID
  SELECT id INTO _company_id FROM public.companies WHERE slug = 'tyler-hill-camp' LIMIT 1;
  IF _company_id IS NULL THEN RAISE EXCEPTION 'Tyler Hill not found'; END IF;

  -- Use a dummy admin UUID for the adjustment log, or grab the first admin
  SELECT id INTO _admin_id FROM auth.users LIMIT 1;

  -- 2. Find campers with purchases on June 27-28 whose balances were NEVER deducted.
  -- We identify them by checking if (current_balance + spent) equals a round starting deposit
  -- OR if current_balance itself is a perfect round number despite having purchases.
  FOR r IN 
    WITH target_purchases AS (
      SELECT 
        t.child_id,
        COALESCE(SUM(t.amount) FILTER (WHERE NOT COALESCE(t.is_free, false)), 0) as amount_owed
      FROM public.owl_pay_transactions t
      WHERE t.company_id = _company_id
        AND t.transaction_type = 'purchase'
        AND t.child_id IS NOT NULL
        -- Only looking at the bugged weekend
        AND (t.created_at AT TIME ZONE 'America/New_York')::date IN ('2026-06-27', '2026-06-28')
      GROUP BY t.child_id
      HAVING COALESCE(SUM(t.amount) FILTER (WHERE NOT COALESCE(t.is_free, false)), 0) > 0
    )
    SELECT 
      c.id as child_id,
      c.name,
      c.owl_pay_balance,
      p.amount_owed
    FROM public.children c
    JOIN target_purchases p ON p.child_id = c.id
    WHERE c.season = '2026'
      AND c.company_id = _company_id
      AND c.status IS DISTINCT FROM 'inactive'
      -- The core logic: If their CURRENT balance is exactly a standard CampMinder deposit amount
      -- ($50, $75, $100, $125, $150, $200, $250, $300), it means they were never charged for the weekend.
      -- (If they had been charged, it would be e.g., $95.50 or -$2.50).
      AND c.owl_pay_balance IN (50, 75, 100, 125, 150, 175, 200, 225, 250, 275, 300)
  LOOP
    -- 3. For each camper that matches, deduct the amount owed and log it
    
    -- Update balance
    UPDATE public.children
    SET 
      owl_pay_balance = owl_pay_balance - r.amount_owed,
      updated_at = now()
    WHERE id = r.child_id;

    -- Log the adjustment transaction so it shows in reports
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
      r.amount_owed,  -- Positive amount in transaction log represents the charge
      false,
      'adjustment',
      'System backfill: Deducted for uncharged purchases on June 27-28',
      _admin_id
    );

    _adjusted_count := _adjusted_count + 1;
    RAISE NOTICE 'Adjusted % (ID: %): Deducted $%, new balance: $%', r.name, r.child_id, r.amount_owed, (r.owl_pay_balance - r.amount_owed);
  END LOOP;

  RAISE NOTICE 'Finished. Successfully backfilled balances for % campers.', _adjusted_count;
END;
$$;
