-- Run once in Supabase SQL Editor (safe to re-run).
-- Fixes Victoria (victoria@tylerhillcamp.com) seeing missing/zero awards.
--
-- Root cause: profiles.role = staff, but user_roles still has division_leader with
-- zero division_permissions (leftover from missed-med cleanup scripts). RLS treats her
-- as a scoped DL → 0 awards. Missed-med emails stay off (no division_leader tag).

-- 1) Align user_roles with profiles.role (one role row per user+company)
UPDATE public.user_roles ur
SET role = 'staff'::public.app_role
FROM auth.users u, public.profiles p, public.companies c
WHERE ur.user_id = u.id
  AND p.id = u.id
  AND c.id = p.company_id
  AND ur.company_id = p.company_id
  AND c.slug = 'tyler-hill-camp'
  AND lower(trim(u.email)) = 'victoria@tylerhillcamp.com'
  AND ur.role IS DISTINCT FROM 'staff'::public.app_role;

-- 2) If no user_roles row exists yet, create staff
INSERT INTO public.user_roles (user_id, role, company_id)
SELECT p.id, 'staff'::public.app_role, p.company_id
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
JOIN public.companies c ON c.id = p.company_id
WHERE c.slug = 'tyler-hill-camp'
  AND lower(trim(u.email)) = 'victoria@tylerhillcamp.com'
  AND NOT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = p.id AND ur.company_id = p.company_id
  );

-- 3) Ensure no division_leader tag (missed-med recipient tag only)
DELETE FROM public.user_tags ut
USING auth.users u, public.profiles p, public.companies c
WHERE ut.user_id = u.id
  AND ut.company_id = c.id
  AND p.id = u.id
  AND c.slug = 'tyler-hill-camp'
  AND lower(trim(u.email)) = 'victoria@tylerhillcamp.com'
  AND ut.tag = 'division_leader';

-- 4) Audit — expect staff role, head_of_girls_side tag, awards_visible = total camp awards
SELECT
  u.email,
  p.role AS profile_role,
  (
    SELECT string_agg(DISTINCT ur.role::text, ', ' ORDER BY ur.role::text)
    FROM public.user_roles ur
    WHERE ur.user_id = u.id
  ) AS user_roles,
  (
    SELECT string_agg(DISTINCT ut.tag::text, ', ' ORDER BY ut.tag::text)
    FROM public.user_tags ut
    WHERE ut.user_id = u.id AND ut.company_id = p.company_id
  ) AS tags,
  (
    SELECT count(*)
    FROM public.division_permissions dp
    WHERE dp.user_id = u.id
  ) AS division_permission_count,
  (
    SELECT count(*)
    FROM public.awards a
    WHERE a.company_id = p.company_id
  ) AS total_camp_awards,
  (
    SELECT count(*)
    FROM public.awards a
    WHERE a.company_id = p.company_id
      AND (
        public.has_role(u.id, 'staff'::public.app_role)
        OR public.has_role(u.id, 'admin'::public.app_role)
        OR (
          a.child_id IS NOT NULL
          AND public.can_access_child(a.child_id)
        )
      )
  ) AS awards_visible_via_rls
FROM auth.users u
JOIN public.profiles p ON p.id = u.id
JOIN public.companies c ON c.id = p.company_id
WHERE c.slug = 'tyler-hill-camp'
  AND lower(trim(u.email)) = 'victoria@tylerhillcamp.com';
