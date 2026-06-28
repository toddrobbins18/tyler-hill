-- Grant Timber Lake West and Timber Lake Camp the same sidebar permissions as Tyler Hill,
-- except Owl Pay (Tyler Hill only). Also align TLW athletics -> sports-calendar for sidebar.

WITH tyler_hill AS (
  SELECT id FROM public.companies WHERE slug = 'tyler-hill-camp' LIMIT 1
),
timber_companies AS (
  SELECT id FROM public.companies WHERE slug IN ('timber-lake-west', 'timber-lake-camp')
),
source_perms AS (
  SELECT rp.role, rp.menu_item, rp.can_access
  FROM public.role_permissions rp
  JOIN tyler_hill th ON rp.company_id = th.id
  WHERE rp.menu_item <> 'owl-pay'
    AND rp.can_access = true
)
INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT tc.id, sp.role, sp.menu_item, sp.can_access
FROM source_perms sp
CROSS JOIN timber_companies tc
ON CONFLICT (company_id, role, menu_item)
DO UPDATE SET can_access = true;

-- TLW sidebar uses sports-calendar; copy athletics grants if present.
INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT rp.company_id, rp.role, 'sports-calendar', rp.can_access
FROM public.role_permissions rp
JOIN public.companies c ON c.id = rp.company_id
WHERE c.slug = 'timber-lake-west'
  AND rp.menu_item = 'athletics'
  AND rp.can_access = true
ON CONFLICT (company_id, role, menu_item)
DO UPDATE SET can_access = true;

-- Timber Lake Camp-only menu items (not on Tyler Hill).
INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT c.id, r.role, m.menu_item, true
FROM public.companies c
CROSS JOIN unnest(ARRAY['admin', 'staff', 'division_leader', 'specialist', 'viewer']::app_role[]) AS r(role)
CROSS JOIN unnest(ARRAY['daily-schedule', 'elective-signup']) AS m(menu_item)
WHERE c.slug = 'timber-lake-camp'
ON CONFLICT (company_id, role, menu_item)
DO UPDATE SET can_access = true;
