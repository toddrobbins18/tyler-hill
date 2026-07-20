-- Enforce one free Owl Pay snack/drink per camper per camp day.
-- Uses America/New_York so evening camp operations do not roll into the next UTC date.

ALTER TABLE public.owl_pay_daily_scans
  ALTER COLUMN scan_date SET DEFAULT ((now() AT TIME ZONE 'America/New_York')::date);

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY company_id, child_id, scan_date
      ORDER BY created_at NULLS LAST, id
    ) AS rn
  FROM public.owl_pay_daily_scans
)
DELETE FROM public.owl_pay_daily_scans d
USING ranked r
WHERE d.id = r.id
  AND r.rn > 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'owl_pay_daily_scans_company_child_date_unique'
      AND conrelid = 'public.owl_pay_daily_scans'::regclass
  ) THEN
    ALTER TABLE public.owl_pay_daily_scans
      ADD CONSTRAINT owl_pay_daily_scans_company_child_date_unique
      UNIQUE (company_id, child_id, scan_date);
  END IF;
END $$;

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
) TO authenticated;
