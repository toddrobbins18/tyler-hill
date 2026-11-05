-- Paperless group counselors: Nest limited to Group Attendance for selected camp groups.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS group_attendance_only boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS assigned_groups text[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.profiles.group_attendance_only IS
  'When true (and assigned_groups set), user sees only Group Attendance in Nest for those groups.';

COMMENT ON COLUMN public.profiles.assigned_groups IS
  'Camp group names this user may mark attendance for when group_attendance_only is true.';

CREATE OR REPLACE FUNCTION public.set_group_counselor_access(
  _user_id uuid,
  _group_attendance_only boolean,
  _assigned_groups text[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  target_company uuid;
  caller uuid := auth.uid();
  groups text[];
BEGIN
  IF caller IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT company_id INTO target_company FROM public.profiles WHERE id = _user_id;
  IF target_company IS NULL THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  IF NOT is_super_admin(caller) THEN
    IF NOT (
      (
        has_role(caller, 'admin'::app_role)
        AND (
          target_company = get_user_company(caller)
          OR get_user_company(caller) IS NULL
        )
      )
      OR EXISTS (
        SELECT 1
        FROM public.user_roles ur
        JOIN public.role_permissions rp
          ON rp.company_id = ur.company_id
         AND rp.role = ur.role
         AND rp.menu_item = 'transport-admin'
         AND rp.can_access = true
        WHERE ur.user_id = caller
          AND ur.company_id = target_company
      )
    ) THEN
      RAISE EXCEPTION 'Not allowed to manage group counselor access';
    END IF;
  END IF;

  SELECT COALESCE(array_agg(DISTINCT trim(g)), '{}')
    INTO groups
  FROM unnest(COALESCE(_assigned_groups, '{}')) AS g
  WHERE length(trim(g)) > 0;

  IF _group_attendance_only AND (groups IS NULL OR cardinality(groups) = 0) THEN
    RAISE EXCEPTION 'Choose at least one group when group attendance only is enabled';
  END IF;

  UPDATE public.profiles
  SET
    group_attendance_only = _group_attendance_only,
    assigned_groups = CASE WHEN _group_attendance_only THEN groups ELSE '{}'::text[] END,
    updated_at = now()
  WHERE id = _user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_group_counselor_access(uuid, boolean, text[]) TO authenticated;
