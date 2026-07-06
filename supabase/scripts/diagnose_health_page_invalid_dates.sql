-- Find rows with invalid or empty timestamps that can crash the Health Center page
-- ("Invalid time value" when date-fns format() runs on bad data).

-- Medication logs with bad date/end_date
SELECT id, child_id, medication_name, date, end_date, late_notes_timestamp
FROM public.medication_logs
WHERE company_id = (SELECT id FROM public.companies WHERE slug = 'tyler-hill-camp' LIMIT 1)
  AND (
    date IS NULL
    OR trim(date::text) = ''
    OR (end_date IS NOT NULL AND trim(end_date::text) = '')
    OR (late_notes_timestamp IS NOT NULL AND late_notes_timestamp::text = '')
  )
LIMIT 50;

-- Health center admissions with bad timestamps
SELECT id, child_id, staff_id, admitted_at, checked_out_at
FROM public.health_center_admissions
WHERE company_id = (SELECT id FROM public.companies WHERE slug = 'tyler-hill-camp' LIMIT 1)
  AND (
    admitted_at IS NULL
    OR (checked_out_at IS NOT NULL AND checked_out_at::text = '')
  )
LIMIT 50;

-- Admission notes with bad created_at
SELECT id, admission_id, created_at
FROM public.health_center_admission_notes
WHERE company_id = (SELECT id FROM public.companies WHERE slug = 'tyler-hill-camp' LIMIT 1)
  AND created_at IS NULL
LIMIT 50;

-- Ensure health@ has health_center role (login works; this confirms nurse page permissions)
SELECT p.email, ur.role
FROM public.profiles p
LEFT JOIN public.user_roles ur ON ur.user_id = p.id AND ur.company_id = p.company_id
WHERE p.email = 'health@tylerhillcamp.com';
