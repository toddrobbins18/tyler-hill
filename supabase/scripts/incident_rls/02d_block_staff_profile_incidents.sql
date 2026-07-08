-- STEP 2d — Block incidents for profile.role = 'staff' (Todd rule)
-- Run after 02c. Fixes staff showing can_create/can_view_all in verification.
-- Safe to re-run.

CREATE OR REPLACE FUNCTION public.user_is_staff_profile_at_company(
  _user_id uuid,
  _company_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    WHERE p.id = _user_id
      AND p.company_id = _company_id
      AND p.role = 'staff'
  );
$$;

CREATE OR REPLACE FUNCTION public.user_can_view_all_company_incidents(
  _user_id uuid,
  _company_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT public.user_is_staff_profile_at_company(_user_id, _company_id)
    AND public.user_matches_role_at_company(
      _user_id,
      _company_id,
      ARRAY['admin']::public.app_role[]
    );
$$;

CREATE OR REPLACE FUNCTION public.user_can_manage_incidents(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT NOT public.user_is_staff_profile_at_company(_user_id, _company_id)
    AND public.user_matches_role_at_company(
      _user_id,
      _company_id,
      ARRAY['admin']::public.app_role[]
    );
$$;

CREATE OR REPLACE FUNCTION public.user_can_create_incident_reports(
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
    OR (
      NOT public.user_is_staff_profile_at_company(_user_id, _company_id)
      AND (
        public.user_matches_role_at_company(
          _user_id,
          _company_id,
          ARRAY['admin']::public.app_role[]
        )
        OR public.user_matches_role_at_company(
          _user_id,
          _company_id,
          ARRAY['division_leader', 'viewer']::public.app_role[]
        )
      )
    );
$$;

-- Re-check Tyler Hill staff (expect 0 rows with can_create or can_view_all)
SELECT
  COUNT(*) AS staff_profiles,
  COUNT(*) FILTER (WHERE public.user_can_create_incident_reports(p.id, c.id)) AS staff_can_create,
  COUNT(*) FILTER (WHERE public.user_can_view_all_company_incidents(p.id, c.id)) AS staff_can_view_all
FROM public.profiles p
JOIN public.companies c ON c.id = p.company_id
WHERE c.slug = 'tyler-hill-camp'
  AND p.role = 'staff'
  AND COALESCE(p.approved, true) = true;
