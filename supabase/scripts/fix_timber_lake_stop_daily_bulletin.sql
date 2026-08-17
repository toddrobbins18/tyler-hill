-- URGENT: Stop Daily Wolf / Tiger Times if they are still sending.
-- automated_email_config alone does NOT stop the daily bulletin cron.
-- Run this entire block in Supabase SQL Editor.

UPDATE public.companies
SET is_active = false,
    updated_at = now()
WHERE slug IN ('timber-lake-camp', 'timber-lake-west');

UPDATE public.company_email_config cec
SET is_active = false,
    updated_at = now()
FROM public.companies c
WHERE c.id = cec.company_id
  AND c.slug IN ('timber-lake-camp', 'timber-lake-west');

-- Must show is_active = false for BOTH rows:
SELECT 'company' AS check, c.slug, c.is_active
FROM public.companies c
WHERE c.slug IN ('timber-lake-camp', 'timber-lake-west')
ORDER BY c.slug;

SELECT 'company_email_config' AS check, c.slug, cec.is_active
FROM public.company_email_config cec
JOIN public.companies c ON c.id = cec.company_id
WHERE c.slug IN ('timber-lake-camp', 'timber-lake-west')
ORDER BY c.slug;
