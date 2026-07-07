-- 1. Check if the cron job ran successfully this morning
SELECT 
  jobid, 
  runid, 
  status, 
  return_message, 
  start_time, 
  end_time
FROM cron.job_run_details
WHERE jobid IN (SELECT jobid FROM cron.job WHERE jobname = 'send-daily-health-center-overnight-log-cron')
ORDER BY start_time DESC
LIMIT 5;

-- 2. Check if the Overnight Log emails were generated for Timber Lake Camp and Timber Lake West today
SELECT 
  c.name AS camp_name,
  m.subject,
  COUNT(m.id) AS emails_sent,
  MAX(m.created_at) AS latest_sent_time
FROM public.messages m
JOIN public.profiles p ON p.id = m.recipient_id
JOIN public.companies c ON c.id = p.company_id
WHERE m.subject ILIKE 'Health Center Overnight Log%'
  AND m.created_at >= CURRENT_DATE
GROUP BY c.name, m.subject
ORDER BY latest_sent_time DESC;

-- 3. Broad check for ALL automated morning messages sent today for TLC and TLW
SELECT 
  c.name AS camp_name,
  m.subject,
  COUNT(m.id) AS emails_sent,
  MAX(m.created_at) AS latest_sent_time
FROM public.messages m
JOIN public.profiles p ON p.id = m.recipient_id
JOIN public.companies c ON c.id = p.company_id
WHERE c.slug IN ('timber-lake-camp', 'timber-lake-west')
  AND m.created_at >= CURRENT_DATE
  AND m.notification_type = 'automated'
GROUP BY c.name, m.subject
ORDER BY latest_sent_time DESC;