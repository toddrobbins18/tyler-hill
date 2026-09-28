-- North Shore Sunshine tag options from Airtable export (Sports / Activities / Lunch).

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
    ('sport',    'Soccer',           'blue',   1),
    ('activity', 'Arts + Crafts',    'pink',   0),
    ('activity', 'Glow party',       'purple', 1),
    ('lunch',    'Pizza',            'orange', 0),
    ('lunch',    'Pasta',            'yellow', 1),
    ('lunch',    'Fruit',            'green',  2),
    ('lunch',    'Jelly Sandwich',   'pink',   3)
  ) AS t(category, label, color, sort_order)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.sunshine_tag_options existing
    WHERE existing.company_id = ns_company_id
      AND existing.category = t.category
      AND existing.label = t.label
  );
END $$;
