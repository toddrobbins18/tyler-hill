-- Let compose UI (staff/admin) read whether outbound email is enabled without exposing M365 secrets.

CREATE OR REPLACE FUNCTION public.get_company_email_delivery_status(_company_id uuid)
RETURNS TABLE (
  is_configured boolean,
  is_active boolean,
  email_ready boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _company_id IS NULL THEN
    RETURN;
  END IF;

  IF NOT (
    public.is_super_admin(auth.uid())
    OR public.user_has_role_for_company(
      auth.uid(),
      _company_id,
      ARRAY['admin', 'staff', 'specialist', 'division_leader']::app_role[]
    )
  ) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(ec.is_configured, false) AS is_configured,
    COALESCE(ec.is_active, true) AS is_active,
    COALESCE(ec.is_configured, false) AND COALESCE(ec.is_active, true) AS email_ready
  FROM public.company_email_config ec
  WHERE ec.company_id = _company_id
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_company_email_delivery_status(uuid) TO authenticated;

-- Direct SELECT fallback for clients not yet using the RPC
DROP POLICY IF EXISTS "Camp staff can view email delivery status" ON public.company_email_config;

CREATE POLICY "Camp staff can view email delivery status"
ON public.company_email_config
FOR SELECT
USING (
  public.is_super_admin(auth.uid())
  OR public.user_has_role_for_company(
    auth.uid(),
    company_id,
    ARRAY['admin', 'staff', 'specialist', 'division_leader']::app_role[]
  )
);
