-- Bus 1 stop 3 mega-stop audit (96 Barkers Point Rd pile-up)
-- Run in Supabase SQL editor for North Shore; set season as needed.

WITH names AS (
  SELECT unnest(ARRAY[
    'Amelia Flores',
    'August Meile',
    'Austen Schembri',
    'Autumn Schwartz',
    'Ava Greene',
    'Caroline Flores',
    'Emma Wunsch',
    'Graham Miness',
    'Graham Schwartz',
    'Lorenzo DeRosa',
    'Marian Schembri',
    'Paula Anais Koutsoyiannis',
    'Paula Koutsoyiannis'
  ]::text[]) AS name
)
SELECT
  n.name,
  ch.season,
  ch.status,
  ch.home_address,
  ch.group_name,
  ch.grade
FROM names n
LEFT JOIN children ch
  ON lower(trim(ch.name)) = lower(trim(n.name))
  AND ch.company_id = (SELECT id FROM companies WHERE slug = 'north-shore-day-camp' LIMIT 1)
WHERE ch.season IN ('2026', '2027')
ORDER BY n.name, ch.season;
