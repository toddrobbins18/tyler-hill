-- Run in Supabase SQL Editor BEFORE deploying sync-campminder.
-- Creates the purchase-totals helper used by financial sync reconciliation.

CREATE OR REPLACE FUNCTION public.get_owl_pay_purchase_totals(_company_id uuid)
RETURNS TABLE(child_id uuid, total_spent numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    t.child_id,
    COALESCE(SUM(t.amount) FILTER (WHERE NOT COALESCE(t.is_free, false)), 0)::numeric AS total_spent
  FROM public.owl_pay_transactions t
  WHERE t.company_id = _company_id
    AND t.transaction_type = 'purchase'
    AND t.child_id IS NOT NULL
  GROUP BY t.child_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_owl_pay_purchase_totals(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_owl_pay_purchase_totals(uuid) TO authenticated;

-- After running this, deploy the edge function:
--   cd tyler-hill && npx supabase functions deploy sync-campminder
