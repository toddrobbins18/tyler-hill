-- Phase 3.1 — Camper, Staff, Messages on North Shore Day Camp
-- Run in Supabase SQL Editor after setup_north_shore_day_camp_foundation.sql
-- Safe to re-run.

DO $$
DECLARE
  ns_company_id uuid;
BEGIN
  SELECT id INTO ns_company_id FROM public.companies WHERE slug = 'north-shore-day-camp';

  IF ns_company_id IS NULL THEN
    RAISE EXCEPTION 'North Shore Day Camp not found — run setup_north_shore_day_camp_foundation.sql first';
  END IF;

  -- Division leaders need Staff (Todd carryover list includes Staff module)
  INSERT INTO public.role_permissions (company_id, role, menu_item, can_access) VALUES
    (ns_company_id, 'division_leader', 'staff', true)
  ON CONFLICT (company_id, role, menu_item) DO UPDATE SET can_access = EXCLUDED.can_access;

END $$;

-- Verify Phase 3.1 menu permissions (roster, staff, messages)
SELECT
  rp.role,
  rp.menu_item,
  rp.can_access
FROM public.role_permissions rp
JOIN public.companies c ON c.id = rp.company_id
WHERE c.slug = 'north-shore-day-camp'
  AND rp.menu_item IN ('roster', 'staff', 'messages')
ORDER BY rp.menu_item, rp.role;

-- Verify company + division exist
SELECT c.id, c.name, c.slug, c.camp_type, c.is_active
FROM public.companies c
WHERE c.slug = 'north-shore-day-camp';

SELECT d.name, d.is_active
FROM public.divisions d
JOIN public.companies c ON c.id = d.company_id
WHERE c.slug = 'north-shore-day-camp'
ORDER BY d.sort_order;

-- Data counts (empty until Phase 5 import / CSV)
SELECT
  (SELECT COUNT(*) FROM public.children ch JOIN public.companies c ON c.id = ch.company_id WHERE c.slug = 'north-shore-day-camp') AS campers,
  (SELECT COUNT(*) FROM public.staff s JOIN public.companies c ON c.id = s.company_id WHERE c.slug = 'north-shore-day-camp') AS staff;
