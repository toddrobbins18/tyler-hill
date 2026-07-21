-- Run in Supabase SQL Editor.
-- Tags all lifeguards / waterfront staff with specialty_sports = ['Waterfront']
-- so Head Specialists (e.g. Sara) see them on the Staff page.

UPDATE public.staff
SET specialty_sports = ARRAY['Waterfront']::text[]
WHERE season = '2026'
  AND (
    role ILIKE '%lifeguard%'
    OR role ILIKE '%waterfront%'
    OR department ILIKE '%water%'
  )
  AND (
    specialty_sports IS NULL
    OR specialty_sports = '{}'
  );

-- Verify
SELECT name, role, specialty_sports
FROM public.staff
WHERE season = '2026'
  AND (
    role ILIKE '%lifeguard%'
    OR role ILIKE '%waterfront%'
    OR department ILIKE '%water%'
  )
ORDER BY name;
