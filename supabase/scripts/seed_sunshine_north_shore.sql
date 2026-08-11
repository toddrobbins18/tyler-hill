-- Seed Sunshine Report groups + tag options for North Shore Day Camp
-- Run in Supabase SQL Editor after 20260805000000_sunshine_report_multi_tenant.sql
-- Safe to re-run (groups upsert by name; tags skip if already present).

DO $$
DECLARE
  ns_company_id uuid;
BEGIN
  SELECT id INTO ns_company_id FROM public.companies WHERE slug = 'north-shore-day-camp';

  IF ns_company_id IS NULL THEN
    RAISE EXCEPTION 'North Shore Day Camp not found — run setup_north_shore_day_camp_foundation.sql first';
  END IF;

  -- Group tabs (matches camp-hug-hub: Bunnies, Ducklings, Giraffes, Koalas, Pandas)
  INSERT INTO public.sunshine_groups (company_id, name, sort_order) VALUES
    (ns_company_id, 'Bunnies',   0),
    (ns_company_id, 'Ducklings', 1),
    (ns_company_id, 'Giraffes',  2),
    (ns_company_id, 'Koalas',    3),
    (ns_company_id, 'Pandas',    4)
  ON CONFLICT (company_id, name) DO UPDATE SET sort_order = EXCLUDED.sort_order;

  -- Tag options for Sports / Activities / Lunch popovers
  INSERT INTO public.sunshine_tag_options (company_id, category, label, color, sort_order)
  SELECT ns_company_id, t.category, t.label, t.color, t.sort_order
  FROM (VALUES
    ('sport',    'Soccer',           'blue',   0),
    ('sport',    'Basketball',       'orange', 1),
    ('sport',    'Tennis',           'green',  2),
    ('sport',    'Swimming',         'teal',   3),
    ('sport',    'Gymnastics',       'purple', 4),
    ('activity', 'Arts & Crafts',    'pink',   0),
    ('activity', 'Music',            'purple', 1),
    ('activity', 'Nature',           'green',  2),
    ('activity', 'Story Time',       'yellow', 3),
    ('activity', 'Playground',       'blue',   4),
    ('lunch',    'Ate well',         'green',  0),
    ('lunch',    'Ate some',         'yellow', 1),
    ('lunch',    'Picky eater',      'orange', 2),
    ('lunch',    'Allergy note',     'pink',   3)
  ) AS t(category, label, color, sort_order)
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.sunshine_tag_options existing
    WHERE existing.company_id = ns_company_id
      AND existing.category = t.category
      AND existing.label = t.label
  );

END $$;

-- Verify
SELECT g.name, g.sort_order
FROM public.sunshine_groups g
JOIN public.companies c ON c.id = g.company_id
WHERE c.slug = 'north-shore-day-camp'
ORDER BY g.sort_order;

SELECT t.category, t.label, t.color, t.sort_order
FROM public.sunshine_tag_options t
JOIN public.companies c ON c.id = t.company_id
WHERE c.slug = 'north-shore-day-camp'
ORDER BY t.category, t.sort_order;
