-- Owl Pay: helper for CampMinder reconciliation and balance backfills.
-- Expected balance = CampMinder deposits - non-free Owl Pay purchases (floor -$25).

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

COMMENT ON FUNCTION public.get_owl_pay_purchase_totals(uuid) IS
  'Returns non-free Owl Pay purchase totals per camper for reconciliation: CM deposits minus these = expected balance.';
