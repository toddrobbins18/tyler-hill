-- Sports Academy: replace legacy day_before send_timing with 1_hour_before.
-- Safe to run multiple times.

UPDATE public.automated_email_config
SET
  send_timing = array_replace(send_timing, 'day_before', '1_hour_before'),
  updated_at = now()
WHERE email_type = 'sports_academy'
  AND send_timing @> ARRAY['day_before']::text[];

-- Remap any already-queued Sports Academy reminders still marked day_before.
UPDATE public.scheduled_notifications
SET timing_type = '1_hour_before'
WHERE email_type = 'sports_academy'
  AND timing_type = 'day_before'
  AND sent = false;
