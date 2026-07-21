-- Run in Supabase SQL Editor (Tyler Hill production).
--
-- Lifeguards were imported under Timber Lake Camp's company_id instead of Tyler Hill's.
-- The Staff page only loads staff for the logged-in company, so Sara never saw them.
--
-- Tyler Hill:  0d0b7f4f-327e-4497-83ff-3aa501ffc295
-- Timber Lake: 1d296ccf-31e1-4176-af57-50a4a4820f82  (wrong — do not use for TH lifeguards)

-- Preview rows that will move
SELECT id, name, role, status, season, company_id, specialty_sports
FROM public.staff
WHERE season = '2026'
  AND role ILIKE '%lifeguard%'
  AND company_id <> '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
ORDER BY name;

-- Move Tyler Hill 2026 lifeguards to the correct company
UPDATE public.staff
SET
  company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid,
  specialty_sports = COALESCE(
    NULLIF(specialty_sports, '{}'),
    ARRAY['Waterfront']::text[]
  ),
  staff_type = COALESCE(staff_type, 'specialist')
WHERE season = '2026'
  AND role ILIKE '%lifeguard%'
  AND company_id <> '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid;

-- Verify: should all show Tyler Hill company_id
SELECT name, role, status, company_id, specialty_sports, staff_type
FROM public.staff
WHERE season = '2026'
  AND role ILIKE '%lifeguard%'
ORDER BY status DESC, name;
