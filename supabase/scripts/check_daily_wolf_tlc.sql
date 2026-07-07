SELECT 
  p.email, 
  p.full_name,
  m.subject,
  m.created_at
FROM public.messages m
JOIN public.profiles p ON p.id = m.recipient_id
JOIN public.companies c ON c.id = p.company_id
WHERE c.slug = 'timber-lake-camp'
  AND m.subject ILIKE 'Daily Wolf%'
  AND m.created_at >= CURRENT_DATE;