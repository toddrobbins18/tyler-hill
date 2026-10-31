-- North Shore program tiers: Nursery → Pre-K → K → 1/2 (1st–2nd) → 3/4 (3rd–4th) → Crew (5th–8th) → CIT (9th).
-- Run in Supabase SQL Editor after CampMinder sync created duplicate/mis-ordered divisions.

BEGIN;

WITH ns AS (
  SELECT id AS company_id FROM public.companies WHERE slug = 'north-shore-day-camp' LIMIT 1
),
program_order AS (
  SELECT * FROM (VALUES
    ('nursery', 1),
    ('pre-k', 2),
    ('kindergarten', 3),
    ('1st', 4),
    ('2nd', 4),
    ('3rd', 5),
    ('4th', 5),
    ('5th', 6),
    ('6th', 6),
    ('7th', 6),
    ('8th', 6),
    ('crew', 6),
    ('9th', 7),
    ('cit', 7)
  ) AS t(program_key, sort_order)
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
      WHEN lower(trim(d.name)) ~ 'crew' THEN 'crew'
      WHEN lower(trim(d.name)) ~ 'cit' THEN 'cit'
      WHEN lower(replace(trim(d.name), ' ', '')) IN ('1/2', '1-2', '12') THEN '1st'
      WHEN lower(replace(trim(d.name), ' ', '')) IN ('3/4', '3-4', '34') THEN '3rd'
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
    END AS program_key
  FROM public.divisions d
  JOIN ns ON d.company_id = ns.company_id
)
UPDATE public.divisions d
SET sort_order = g.sort_order
FROM labeled l
JOIN program_order g ON g.program_key = l.program_key
WHERE d.id = l.id AND l.program_key IS NOT NULL;

COMMIT;

SELECT d.name, d.sort_order
FROM public.divisions d
JOIN public.companies c ON c.id = d.company_id
WHERE c.slug = 'north-shore-day-camp'
  AND d.is_active IS DISTINCT FROM false
ORDER BY d.sort_order NULLS LAST, d.name;
