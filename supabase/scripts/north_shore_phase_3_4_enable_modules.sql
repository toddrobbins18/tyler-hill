-- Phase 3.4 — Appointments, Incident Reports, Reports on North Shore Day Camp
-- Run in Supabase SQL Editor (verify only — permissions seeded in foundation)

SELECT
  rp.role,
  rp.menu_item,
  rp.can_access
FROM public.role_permissions rp
JOIN public.companies c ON c.id = rp.company_id
WHERE c.slug = 'north-shore-day-camp'
  AND rp.menu_item IN ('appointments', 'incidents', 'reports')
ORDER BY rp.menu_item, rp.role;

SELECT
  (SELECT COUNT(*) FROM public.appointments a JOIN public.companies c ON c.id = a.company_id WHERE c.slug = 'north-shore-day-camp') AS appointments,
  (SELECT COUNT(*) FROM public.incident_reports i JOIN public.companies c ON c.id = i.company_id WHERE c.slug = 'north-shore-day-camp') AS incident_reports;
