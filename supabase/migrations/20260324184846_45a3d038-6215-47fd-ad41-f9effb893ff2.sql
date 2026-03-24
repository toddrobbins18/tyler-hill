
-- Table to track synced CampMinder financial transactions (prevent double-counting)
CREATE TABLE public.campminder_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  cm_transaction_id text NOT NULL,
  person_id text NOT NULL,
  amount numeric NOT NULL,
  transaction_type text NOT NULL DEFAULT 'deposit',
  synced_at timestamptz DEFAULT now(),
  UNIQUE(company_id, cm_transaction_id)
);

ALTER TABLE public.campminder_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view own company transactions" ON public.campminder_transactions
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company(auth.uid()));

-- RPC to increment/decrement camper balance atomically
CREATE OR REPLACE FUNCTION public.increment_camper_balance(
  _child_id uuid,
  _amount numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  new_balance numeric;
BEGIN
  UPDATE public.children
  SET owl_pay_balance = owl_pay_balance + _amount,
      updated_at = now()
  WHERE id = _child_id
  RETURNING owl_pay_balance INTO new_balance;
  
  RETURN new_balance;
END;
$$;
