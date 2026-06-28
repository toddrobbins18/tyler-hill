-- Allow Owl Pay balances down to -$25; deposits still use increment_camper_balance (+amount).

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
  min_balance constant numeric := -25;
BEGIN
  UPDATE public.children
  SET owl_pay_balance = owl_pay_balance + _amount,
      updated_at = now()
  WHERE id = _child_id
    AND (owl_pay_balance + _amount) >= min_balance
  RETURNING owl_pay_balance INTO new_balance;

  IF new_balance IS NULL THEN
    RAISE EXCEPTION 'Owl Pay balance cannot go below -$25.00';
  END IF;

  RETURN new_balance;
END;
$$;
