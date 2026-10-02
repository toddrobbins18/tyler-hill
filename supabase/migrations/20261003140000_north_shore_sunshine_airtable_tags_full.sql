-- North Shore Sunshine tag options — Airtable Giraffes sheet (Sports / Activities / Lunch).
-- Safe to re-run: skips labels already present for the camp.

DO $$
DECLARE
  ns_company_id uuid;
BEGIN
  SELECT id INTO ns_company_id FROM public.companies WHERE slug = 'north-shore-day-camp';
  IF ns_company_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.sunshine_tag_options (company_id, category, label, color, sort_order)
  SELECT ns_company_id, t.category, t.label, t.color, t.sort_order
  FROM (VALUES
    ('sport',    'Swimming',         'teal',   0),
    ('activity', 'Glow party',       'gray',   0),
    ('activity', 'Starfish huddle',  'teal',   1),
    ('activity', 'Yoga',             'blue',   2),
    ('activity', 'Turf''s Up',       'purple', 3),
    ('activity', 'Cooking',          'pink',   4),
    ('lunch',    'Pasta',            'pink',   0),
    ('lunch',    'Pizza',            'purple', 1),
    ('lunch',    'Cucumber',         'orange', 2),
    ('lunch',    'Bagel',            'blue',   3),
    ('lunch',    'Jelly Sand',       'yellow', 4)
  ) AS t(category, label, color, sort_order)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.sunshine_tag_options existing
    WHERE existing.company_id = ns_company_id
      AND existing.category = t.category
      AND existing.label = t.label
  );
END $$;
