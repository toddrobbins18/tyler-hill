-- Tyler Hill: missed med alerts → division_leader tag only
UPDATE public.automated_email_config aec
SET
  recipient_tags = ARRAY['division_leader']::text[],
  send_timing = ARRAY['on_create']::text[],
  updated_at = now()
FROM public.companies c
WHERE aec.company_id = c.id
  AND c.slug = 'tyler-hill-camp'
  AND aec.email_type = 'missed_medication';

-- Verify
SELECT c.slug, aec.recipient_tags, aec.send_timing, aec.enabled
FROM automated_email_config aec
JOIN companies c ON c.id = aec.company_id
WHERE aec.email_type = 'missed_medication'
ORDER BY c.name;
