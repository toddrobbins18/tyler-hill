-- Run this ONLY if Step 2 failed on the last UPDATE (duplicate key error).
-- Safe to re-run. Does not change RLS policies/functions.

-- Remove duplicate stale rows (user already has a row at profile company_id)
DELETE FROM public.user_roles ur
USING public.profiles p
WHERE ur.user_id = p.id
  AND p.company_id IS NOT NULL
  AND ur.company_id IS DISTINCT FROM p.company_id
  AND ur.role::text = p.role
  AND EXISTS (
    SELECT 1
    FROM public.user_roles ur2
    WHERE ur2.user_id = p.id
      AND ur2.company_id = p.company_id
  );

-- Fix remaining rows where company_id still wrong
UPDATE public.user_roles ur
SET company_id = p.company_id
FROM public.profiles p
WHERE ur.user_id = p.id
  AND p.company_id IS NOT NULL
  AND ur.company_id IS DISTINCT FROM p.company_id
  AND ur.role::text = p.role;

-- Optional: show any Tyler Hill users still mismatched
SELECT
  p.email,
  p.full_name,
  p.role AS profile_role,
  p.company_id AS profile_company_id,
  ur.role AS user_roles_role,
  ur.company_id AS user_roles_company_id
FROM public.profiles p
JOIN public.companies c ON c.id = p.company_id
LEFT JOIN public.user_roles ur ON ur.user_id = p.id
WHERE c.slug = 'tyler-hill-camp'
  AND (
    ur.id IS NULL
    OR ur.company_id IS DISTINCT FROM c.id
    OR ur.role::text IS DISTINCT FROM p.role
  )
ORDER BY p.email;
