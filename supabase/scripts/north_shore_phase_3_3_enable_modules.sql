-- Phase 3.3 — Activities, Special Events, Rainy Day on North Shore Day Camp
-- Run in Supabase SQL Editor (verify only — permissions seeded in foundation)

SELECT
  rp.role,
  rp.menu_item,
  rp.can_access
FROM public.role_permissions rp
JOIN public.companies c ON c.id = rp.company_id
WHERE c.slug = 'north-shore-day-camp'
  AND rp.menu_item IN ('activities', 'special-events', 'rainy-day')
ORDER BY rp.menu_item, rp.role;

SELECT
  (SELECT COUNT(*) FROM public.activities_field_trips a JOIN public.companies c ON c.id = a.company_id WHERE c.slug = 'north-shore-day-camp') AS activities,
  (SELECT COUNT(*) FROM public.special_events_activities s JOIN public.companies c ON c.id = s.company_id WHERE c.slug = 'north-shore-day-camp') AS special_events,
  (SELECT COUNT(*) FROM public.rainy_day_documents r JOIN public.companies c ON c.id = r.company_id WHERE c.slug = 'north-shore-day-camp') AS rainy_day_docs;
