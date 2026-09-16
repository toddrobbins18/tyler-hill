-- Add optional location field to incident reports
ALTER TABLE public.incident_reports
  ADD COLUMN IF NOT EXISTS location text;

COMMENT ON COLUMN public.incident_reports.location IS 'Where the incident occurred (e.g. playground, pool, bunk)';
