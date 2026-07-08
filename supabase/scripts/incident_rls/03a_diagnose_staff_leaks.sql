-- STEP 3 diagnostic — Tyler Hill staff who still pass incident checks (should be 0 after fix)
SELECT
  p.email,
  p.full_name,
  p.role AS profile_role,
  ur.role AS user_roles_role,
  ur.company_id AS user_roles_company_id,
  public.user_can_create_incident_reports(p.id, c.id) AS can_create,
  public.user_can_view_all_company_incidents(p.id, c.id) AS can_view_all,
  public.user_has_incidents_page_access(p.id, c.id) AS has_menu
FROM public.profiles p
JOIN public.companies c ON c.id = p.company_id
LEFT JOIN public.user_roles ur ON ur.user_id = p.id AND ur.company_id = c.id
WHERE c.slug = 'tyler-hill-camp'
  AND p.role = 'staff'
  AND COALESCE(p.approved, true) = true
  AND (
    public.user_can_create_incident_reports(p.id, c.id)
    OR public.user_can_view_all_company_incidents(p.id, c.id)
  )
ORDER BY p.email;

-- All user_roles rows for those mismatched staff (may have admin/DL on login role)
SELECT
  p.email,
  p.role AS profile_role,
  ur.role AS login_role,
  ur.company_id,
  co.slug AS camp_slug
FROM public.profiles p
JOIN public.user_roles ur ON ur.user_id = p.id
LEFT JOIN public.companies co ON co.id = ur.company_id
JOIN public.companies th ON th.slug = 'tyler-hill-camp' AND th.id = p.company_id
WHERE p.role = 'staff'
  AND ur.role IN ('admin', 'division_leader', 'viewer')
ORDER BY p.email, ur.role;
