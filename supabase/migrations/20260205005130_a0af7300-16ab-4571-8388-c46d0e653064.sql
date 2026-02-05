-- Add toothfairy email type to automated_email_config for all companies that don't have it yet
INSERT INTO public.automated_email_config (company_id, email_type, recipient_tags, enabled, send_timing)
SELECT 
  c.id as company_id,
  'toothfairy' as email_type,
  ARRAY['nurse']::text[] as recipient_tags,
  true as enabled,
  ARRAY['on_create']::text[] as send_timing
FROM public.companies c
WHERE NOT EXISTS (
  SELECT 1 FROM public.automated_email_config aec 
  WHERE aec.company_id = c.id AND aec.email_type = 'toothfairy'
);