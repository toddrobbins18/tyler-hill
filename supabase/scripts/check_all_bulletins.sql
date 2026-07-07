SELECT 
  c.name AS company_name,
  COUNT(m.id) AS email_count,
  m.subject
FROM public.messages m
JOIN public.profiles p ON p.id = m.recipient_id
JOIN public.companies c ON c.id = p.company_id
WHERE m.created_at >= CURRENT_DATE
  AND (m.subject ILIKE 'Daily Wolf%' OR m.subject ILIKE 'Tiger Times%')
GROUP BY c.name, m.subject
ORDER BY c.name, m.subject;