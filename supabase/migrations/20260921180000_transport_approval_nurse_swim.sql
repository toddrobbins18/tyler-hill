-- Nurse sent-home and swim lessons require staff transport approval (like pickup_changes / absences)
-- before they affect routes, change sheets, and daily paperwork.

ALTER TABLE public.nurse_records
  ADD COLUMN IF NOT EXISTS transport_status text;

ALTER TABLE public.swim_lessons
  ADD COLUMN IF NOT EXISTS transport_status text;

COMMENT ON COLUMN public.nurse_records.transport_status IS
  'submitted = sent home pending staff approval; acknowledged = on routes/paperwork; null = not sent home';
COMMENT ON COLUMN public.swim_lessons.transport_status IS
  'submitted = parent confirmed, pending staff approval; acknowledged = on routes/paperwork';

-- Preserve existing production behavior until staff re-approves under the new workflow.
UPDATE public.nurse_records
SET transport_status = 'acknowledged'
WHERE sent_home = true AND transport_status IS NULL;

UPDATE public.swim_lessons
SET transport_status = 'acknowledged'
WHERE parent_confirmed = true AND transport_status IS NULL;
