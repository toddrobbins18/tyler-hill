-- Enforce missed medication alerts: division leaders only, exclude camp admins/directors.
-- Deploy check-medication-alerts edge function after applying DB changes.

-- Tyler Hill config (idempotent)
UPDATE public.automated_email_config aec
SET
  recipient_tags = ARRAY['division_leader']::text[],
  send_timing = ARRAY['on_create']::text[],
  updated_at = now()
FROM public.companies c
WHERE aec.company_id = c.id
  AND c.slug = 'tyler-hill-camp'
  AND aec.email_type = 'missed_medication';
