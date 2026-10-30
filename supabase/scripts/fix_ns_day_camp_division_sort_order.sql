-- Align North Shore grade division sort_order: Nursery → Pre-K → Kindergarten → 1st …
-- Run in Supabase SQL Editor after CampMinder sync created duplicate/mis-ordered divisions.

BEGIN;

WITH ns AS (
  SELECT id AS company_id FROM public.companies WHERE slug = 'north-shore-day-camp' LIMIT 1
),
grade_order AS (
  SELECT * FROM (VALUES
    ('nursery', 1),
    ('pre-k', 2),
    ('kindergarten', 3),
    ('1st', 4),
    ('2nd', 5),
    ('3rd', 6),
    ('4th', 7),
    ('5th', 8),
    ('6th', 9),
    ('7th', 10),
    ('8th', 11),
    ('9th', 12)
  ) AS t(grade_key, sort_order)
),
labeled AS (
  SELECT
    d.id,
    d.name,
    CASE
      WHEN lower(trim(d.name)) ~ '^nursery' THEN 'nursery'
      WHEN lower(replace(replace(trim(d.name), ' ', ''), '-', '')) IN ('prek', 'pk')
        OR lower(trim(d.name)) ~ '^pre\s*-?\s*k' THEN 'pre-k'
      WHEN lower(trim(d.name)) IN ('k', 'kg', 'kindergarten')
        OR lower(trim(d.name)) ~ '^kinder(garten)?$' THEN 'kindergarten'
      WHEN lower(trim(d.name)) ~ '^1(st)?$' THEN '1st'
      WHEN lower(trim(d.name)) ~ '^2(nd)?$' THEN '2nd'
      WHEN lower(trim(d.name)) ~ '^3(rd)?$' THEN '3rd'
      WHEN lower(trim(d.name)) ~ '^4(th)?$' THEN '4th'
      WHEN lower(trim(d.name)) ~ '^5(th)?$' THEN '5th'
      WHEN lower(trim(d.name)) ~ '^6(th)?$' THEN '6th'
      WHEN lower(trim(d.name)) ~ '^7(th)?$' THEN '7th'
      WHEN lower(trim(d.name)) ~ '^8(th)?$' THEN '8th'
      WHEN lower(trim(d.name)) ~ '^9(th)?$' THEN '9th'
      ELSE NULL
    END AS grade_key
  FROM public.divisions d
  JOIN ns ON d.company_id = ns.company_id
)
UPDATE public.divisions d
SET sort_order = g.sort_order
FROM labeled l
JOIN grade_order g ON g.grade_key = l.grade_key
WHERE d.id = l.id AND l.grade_key IS NOT NULL;

COMMIT;

SELECT d.name, d.sort_order
FROM public.divisions d
JOIN public.companies c ON c.id = d.company_id
WHERE c.slug = 'north-shore-day-camp'
  AND d.is_active IS DISTINCT FROM false
ORDER BY d.sort_order NULLS LAST, d.name;
