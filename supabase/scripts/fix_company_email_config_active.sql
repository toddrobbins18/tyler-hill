-- Re-enable email sending for camps that configured M365 but have is_active = false.
-- Run in Supabase SQL editor if compose shows "Ready" but emails never send.

UPDATE public.company_email_config
SET is_active = true,
    updated_at = now()
WHERE is_configured = true
  AND COALESCE(is_active, true) = false;

-- Audit: configured camps and active flag
SELECT
  c.name AS company,
  ec.is_configured,
  ec.is_active,
  ec.m365_sender_email,
  ec.last_test_status,
  ec.last_tested_at
FROM public.company_email_config ec
JOIN public.companies c ON c.id = ec.company_id
ORDER BY c.name;
