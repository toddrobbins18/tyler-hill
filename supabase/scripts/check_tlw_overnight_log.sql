-- Check if TLW has the health_center_overnight_log config enabled
SELECT 
  c.name, 
  aec.email_type, 
  aec.recipient_tags, 
  aec.enabled
FROM public.automated_email_config aec
JOIN public.companies c ON c.id = aec.company_id
WHERE aec.email_type = 'health_center_overnight_log'
  AND c.slug IN ('timber-lake-camp', 'timber-lake-west');

-- Check if TLW has any users with the 'director' tag
SELECT 
  c.name,
  p.email,
  ut.tag
FROM public.user_tags ut
JOIN public.profiles p ON p.id = ut.user_id
JOIN public.companies c ON c.id = ut.company_id
WHERE c.slug = 'timber-lake-west'
  AND ut.tag = 'director';