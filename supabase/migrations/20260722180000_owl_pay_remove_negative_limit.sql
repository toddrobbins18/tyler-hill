-- Remove Owl Pay negative balance cap (Todd: no limit — balance follows deposits minus spend).

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
BEGIN
  UPDATE public.children
  SET owl_pay_balance = owl_pay_balance + _amount,
      updated_at = now()
  WHERE id = _child_id
  RETURNING owl_pay_balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'Camper not found';
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
    RETURNING owl_pay_balance INTO new_balance;

    IF new_balance IS NULL THEN
      RAISE EXCEPTION 'Unable to update camper balance (camper not found)';
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
