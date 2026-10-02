-- North Shore Sunshine tag options — full Airtable Bunnies sheet (Sports / Activities / Lunch).
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
    ('sport', 'Adventure Course', 'teal', 0),
    ('sport', 'Basketball', 'blue', 1),
    ('sport', 'Climbing Wall', 'green', 2),
    ('sport', 'FAST', 'orange', 3),
    ('sport', 'Gymnastics', 'purple', 4),
    ('sport', 'Soccer', 'teal', 5),
    ('sport', 'Softball', 'blue', 6),
    ('sport', 'Swimming', 'green', 7),
    ('sport', 'Tennis', 'orange', 8),
    ('sport', 'FUNtastic Fridays', 'purple', 9),
    ('sport', 'Train', 'teal', 10),
    ('activity', 'Adventureland', 'pink', 0),
    ('activity', 'Arts + Crafts', 'purple', 1),
    ('activity', 'Carnival', 'yellow', 2),
    ('activity', 'Construction Zone', 'blue', 3),
    ('activity', 'Cooking', 'green', 4),
    ('activity', 'Dance', 'gray', 5),
    ('activity', 'Jumping Pillow', 'teal', 6),
    ('activity', 'Mansion Play', 'pink', 7),
    ('activity', 'Music', 'purple', 8),
    ('activity', 'Playground', 'yellow', 9),
    ('activity', 'SS Village', 'blue', 10),
    ('activity', 'TGIM', 'green', 11),
    ('activity', 'Trackless Train', 'gray', 12),
    ('activity', 'Triathlon Events', 'teal', 13),
    ('activity', 'Tug of War', 'pink', 14),
    ('activity', 'Turf''s Up', 'purple', 15),
    ('activity', 'Water Relays', 'yellow', 16),
    ('activity', 'Wonderworks', 'blue', 17),
    ('activity', 'Imagination play', 'green', 18),
    ('activity', 'Olympics', 'gray', 19),
    ('activity', 'Show Club', 'teal', 20),
    ('activity', 'Dance party', 'pink', 21),
    ('activity', 'Yoga', 'purple', 22),
    ('activity', 'Storytime', 'yellow', 23),
    ('activity', 'Movie', 'blue', 24),
    ('activity', 'Basketball', 'green', 25),
    ('activity', 'Starfish huddle', 'gray', 26),
    ('activity', 'Fun house', 'teal', 27),
    ('activity', 'Water Games', 'pink', 28),
    ('activity', 'Glow party', 'purple', 29),
    ('lunch', 'Bagel', 'orange', 0),
    ('lunch', 'Cereal/French Toast', 'yellow', 1),
    ('lunch', 'Chicken', 'green', 2),
    ('lunch', 'Fruit', 'pink', 3),
    ('lunch', 'Grilled Cheese', 'teal', 4),
    ('lunch', 'Hamburger', 'blue', 5),
    ('lunch', 'Mac & Cheese', 'purple', 6),
    ('lunch', 'Meatballs + Spaghetti', 'orange', 7),
    ('lunch', 'Pasta', 'yellow', 8),
    ('lunch', 'Pizza', 'green', 9),
    ('lunch', 'Quesadilla', 'pink', 10),
    ('lunch', 'Sandwich', 'teal', 11),
    ('lunch', 'Stuffed Shells', 'blue', 12),
    ('lunch', 'Yogurt', 'purple', 13),
    ('lunch', 'Sliced Hotdog', 'orange', 14),
    ('lunch', 'Cucumber', 'yellow', 15),
    ('lunch', 'Turkey', 'green', 16),
    ('lunch', 'Cheese sandwich', 'pink', 17),
    ('lunch', 'Banana', 'teal', 18),
    ('lunch', 'Jelly Sandwich', 'blue', 19),
    ('lunch', 'Baked ziti', 'purple', 20),
    ('lunch', 'Sausage', 'orange', 21),
    ('lunch', 'Rice', 'yellow', 22),
    ('lunch', 'Starfish Buffet', 'green', 23),
    ('lunch', 'Hot dog', 'pink', 24),
    ('lunch', 'Carrot', 'teal', 25),
    ('lunch', 'Tomatoes', 'blue', 26),
    ('lunch', 'Watermelon', 'purple', 27),
    ('lunch', 'Pizza bagel', 'orange', 28),
    ('lunch', 'Oranges', 'yellow', 29),
    ('lunch', 'Kosher Nuggets', 'green', 30),
    ('lunch', 'Kosher Burger', 'pink', 31),
    ('lunch', 'Veggie Nuggets', 'teal', 32),
    ('lunch', 'Veggie Burger', 'blue', 33),
    ('lunch', 'Salami', 'purple', 34),
    ('lunch', 'Corn', 'orange', 35),
    ('lunch', 'Tortellini', 'yellow', 36),
    ('lunch', 'Brocolli', 'green', 37),
    ('lunch', 'Bread', 'pink', 38),
    ('lunch', 'Turkey sandwich', 'teal', 39),
    ('lunch', 'Chickpeas', 'blue', 40),
    ('lunch', 'Boiled egg', 'purple', 41),
    ('lunch', 'Meatballs', 'orange', 42),
    ('lunch', 'Vegetarian Option', 'yellow', 43),
    ('lunch', 'Salad', 'green', 44),
    ('lunch', 'Beans', 'pink', 45),
    ('lunch', 'Cheese', 'teal', 46),
    ('lunch', 'Cranberry', 'blue', 47),
    ('lunch', 'Peaches', 'purple', 48)
  ) AS t(category, label, color, sort_order)
  WHERE NOT EXISTS (
    SELECT 1 FROM public.sunshine_tag_options existing
    WHERE existing.company_id = ns_company_id
      AND existing.category = t.category
      AND existing.label = t.label
  );
END $$;
