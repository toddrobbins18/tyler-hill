-- Phase 3.2 — Master Calendar, Menu, Daily news on North Shore Day Camp
-- Run in Supabase SQL Editor (safe to re-run — verify only; permissions seeded in foundation)

-- Verify menu permissions for calendar, menu, notes
SELECT
  rp.role,
  rp.menu_item,
  rp.can_access
FROM public.role_permissions rp
JOIN public.companies c ON c.id = rp.company_id
WHERE c.slug = 'north-shore-day-camp'
  AND rp.menu_item IN ('calendar', 'menu', 'notes')
ORDER BY rp.menu_item, rp.role;

-- Sample data counts (empty until import)
SELECT
  (SELECT COUNT(*) FROM public.menu_items mi JOIN public.companies c ON c.id = mi.company_id WHERE c.slug = 'north-shore-day-camp') AS menu_rows,
  (SELECT COUNT(*) FROM public.activities_field_trips a JOIN public.companies c ON c.id = a.company_id WHERE c.slug = 'north-shore-day-camp') AS calendar_activities,
  (SELECT COUNT(*) FROM public.special_events_activities s JOIN public.companies c ON c.id = s.company_id WHERE c.slug = 'north-shore-day-camp') AS calendar_special_events;
