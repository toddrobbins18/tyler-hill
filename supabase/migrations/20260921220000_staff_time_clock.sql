-- Daily staff time clock (QR / RFID sign in & out). Overnight camps only in UI.

ALTER TABLE public.staff
  ADD COLUMN IF NOT EXISTS qr_token text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_staff_qr_token
  ON public.staff (qr_token)
  WHERE qr_token IS NOT NULL;

COMMENT ON COLUMN public.staff.qr_token IS
  'Unique token encoded in staff QR badge (NEST-STAFF-{token}).';

CREATE TABLE IF NOT EXISTS public.staff_time_clock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  season text NOT NULL,
  staff_id uuid NOT NULL REFERENCES public.staff(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  signed_in_at timestamptz,
  signed_out_at timestamptz,
  sign_in_method text CHECK (sign_in_method IN ('qr', 'rfid', 'manual')),
  sign_out_method text CHECK (sign_out_method IN ('qr', 'rfid', 'manual', 'auto')),
  auto_signed_out boolean NOT NULL DEFAULT false,
  signed_in_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  signed_out_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, staff_id, work_date, season)
);

CREATE INDEX IF NOT EXISTS idx_staff_time_clock_company_date
  ON public.staff_time_clock (company_id, season, work_date DESC);

CREATE INDEX IF NOT EXISTS idx_staff_time_clock_open
  ON public.staff_time_clock (company_id, season, work_date)
  WHERE signed_in_at IS NOT NULL AND signed_out_at IS NULL;

COMMENT ON TABLE public.staff_time_clock IS
  'Daily staff sign-in/out punches (separate from OD night-off curfew sheet).';

ALTER TABLE public.staff_time_clock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view staff_time_clock for their company" ON public.staff_time_clock;
DROP POLICY IF EXISTS "Users can manage staff_time_clock for their company" ON public.staff_time_clock;

CREATE POLICY "Users can view staff_time_clock for their company"
  ON public.staff_time_clock
  FOR SELECT
  TO authenticated
  USING (
    company_id IS NOT NULL
    AND public.user_can_view_od_company_data(auth.uid(), company_id)
  );

CREATE POLICY "Users can manage staff_time_clock for their company"
  ON public.staff_time_clock
  FOR ALL
  TO authenticated
  USING (
    company_id IS NOT NULL
    AND public.user_can_manage_od_data(auth.uid(), company_id)
  )
  WITH CHECK (
    company_id IS NOT NULL
    AND public.user_can_manage_od_data(auth.uid(), company_id)
  );

GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_time_clock TO authenticated;
GRANT ALL ON public.staff_time_clock TO service_role;

-- Permissions: same camps/roles as OD Management (overnight staff tracking).
INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT company_id, role, 'staff-time-clock', can_access
FROM public.role_permissions
WHERE menu_item = 'od-management'
ON CONFLICT (company_id, role, menu_item) DO UPDATE SET can_access = EXCLUDED.can_access;
