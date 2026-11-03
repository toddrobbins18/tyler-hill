-- Group activity schedules scanned from uploaded spreadsheets.
-- Weekly rows (applies_on null) repeat every week. A dated row replaces that group for one day.

CREATE TABLE IF NOT EXISTS public.group_schedule_uploads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  season text NOT NULL,
  file_name text NOT NULL,
  applies_on date,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.group_schedule_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  upload_id uuid NOT NULL REFERENCES public.group_schedule_uploads(id) ON DELETE CASCADE,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  season text NOT NULL,
  group_name text NOT NULL,
  day_of_week smallint,
  applies_on date,
  start_time time NOT NULL,
  end_time time NOT NULL,
  activity text NOT NULL,
  location text NOT NULL DEFAULT '',
  CONSTRAINT group_schedule_slots_day_chk CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
  CONSTRAINT group_schedule_slots_time_chk CHECK (end_time > start_time)
);

CREATE INDEX IF NOT EXISTS idx_group_schedule_slots_lookup
  ON public.group_schedule_slots (company_id, season, day_of_week);

CREATE INDEX IF NOT EXISTS idx_group_schedule_uploads_company
  ON public.group_schedule_uploads (company_id, season, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_schedule_uploads TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_schedule_slots TO authenticated;
GRANT ALL ON public.group_schedule_uploads TO service_role;
GRANT ALL ON public.group_schedule_slots TO service_role;

ALTER TABLE public.group_schedule_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_schedule_slots ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.user_can_manage_group_schedules(
  _user_id uuid,
  _company_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.is_super_admin(_user_id)
    OR _company_id = public.get_user_company(_user_id)
    OR public.user_has_role_for_company(
      _user_id,
      _company_id,
      ARRAY['admin', 'staff', 'division_leader', 'specialist', 'health_center', 'viewer']::public.app_role[]
    );
$$;

DROP POLICY IF EXISTS "Staff manage group schedule uploads" ON public.group_schedule_uploads;
CREATE POLICY "Staff manage group schedule uploads"
  ON public.group_schedule_uploads
  FOR ALL
  TO authenticated
  USING (public.user_can_manage_group_schedules(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_group_schedules(auth.uid(), company_id));

DROP POLICY IF EXISTS "Staff manage group schedule slots" ON public.group_schedule_slots;
CREATE POLICY "Staff manage group schedule slots"
  ON public.group_schedule_slots
  FOR ALL
  TO authenticated
  USING (public.user_can_manage_group_schedules(auth.uid(), company_id))
  WITH CHECK (public.user_can_manage_group_schedules(auth.uid(), company_id));

INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT DISTINCT ON (company_id, role)
  company_id,
  role,
  'schedules',
  true
FROM public.role_permissions
WHERE menu_item IN ('group-attendance', 'roster', 'activities', 'front-office')
  AND can_access = true
ORDER BY company_id, role, CASE menu_item
  WHEN 'group-attendance' THEN 0
  WHEN 'roster' THEN 1
  WHEN 'front-office' THEN 2
  ELSE 3
END
ON CONFLICT (company_id, role, menu_item) DO UPDATE
  SET can_access = true;

COMMENT ON TABLE public.group_schedule_slots IS
  'Scanned group periods. applies_on null repeats weekly; a date replaces that group for one day.';
