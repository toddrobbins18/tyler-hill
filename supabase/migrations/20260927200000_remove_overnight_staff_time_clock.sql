-- HootTrack (staff time clock) is day-camp only. Remove overnight camp access and data.

CREATE OR REPLACE FUNCTION public.company_is_day_camp(_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.companies c
    WHERE c.id = _company_id
      AND (c.camp_type = 'day_camp' OR c.slug = 'north-shore-day-camp')
  );
$$;

COMMENT ON FUNCTION public.company_is_day_camp(uuid) IS
  'True for day camp companies (North Shore and future day camps).';

-- Revoke HootTrack menu permissions on overnight camps.
DELETE FROM public.role_permissions rp
USING public.companies c
WHERE c.id = rp.company_id
  AND rp.menu_item = 'staff-time-clock'
  AND NOT public.company_is_day_camp(c.id);

-- Remove any overnight punch records (e.g. from testing).
DELETE FROM public.staff_time_clock stc
USING public.companies c
WHERE c.id = stc.company_id
  AND NOT public.company_is_day_camp(c.id);

-- Clear HootTrack QR tokens on overnight staff.
UPDATE public.staff s
SET qr_token = NULL
FROM public.companies c
WHERE c.id = s.company_id
  AND NOT public.company_is_day_camp(c.id)
  AND s.qr_token IS NOT NULL;

COMMENT ON TABLE public.staff_time_clock IS
  'Daily staff sign-in/out (HootTrack) — day camps only. Overnight camps use OD Management.';

DROP POLICY IF EXISTS "Users can view staff_time_clock for their company" ON public.staff_time_clock;
DROP POLICY IF EXISTS "Users can manage staff_time_clock for their company" ON public.staff_time_clock;

CREATE POLICY "Users can view staff_time_clock for day camp companies"
  ON public.staff_time_clock
  FOR SELECT
  TO authenticated
  USING (
    company_id IS NOT NULL
    AND public.company_is_day_camp(company_id)
    AND public.user_can_view_od_company_data(auth.uid(), company_id)
  );

CREATE POLICY "Users can manage staff_time_clock for day camp companies"
  ON public.staff_time_clock
  FOR ALL
  TO authenticated
  USING (
    company_id IS NOT NULL
    AND public.company_is_day_camp(company_id)
    AND public.user_can_manage_od_data(auth.uid(), company_id)
  )
  WITH CHECK (
    company_id IS NOT NULL
    AND public.company_is_day_camp(company_id)
    AND public.user_can_manage_od_data(auth.uid(), company_id)
  );
