-- Reliable free-daily check for Owl Pay POS (bypasses RLS on owl_pay_daily_scans).

CREATE OR REPLACE FUNCTION public.is_owl_pay_free_daily_available(
  _company_id uuid,
  _child_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT EXISTS (
    SELECT 1
    FROM public.owl_pay_daily_scans
    WHERE company_id = _company_id
      AND child_id = _child_id
      AND scan_date = (now() AT TIME ZONE 'America/New_York')::date
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_owl_pay_free_daily_available(uuid, uuid) TO authenticated;
