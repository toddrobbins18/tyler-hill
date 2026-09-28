-- Day camp / Airtable-style health center visit fields (North Shore visit log).

ALTER TABLE public.health_center_admissions
  ADD COLUMN IF NOT EXISTS treatment text,
  ADD COLUMN IF NOT EXISTS incident_location text,
  ADD COLUMN IF NOT EXISTS group_name text,
  ADD COLUMN IF NOT EXISTS counselor_name text,
  ADD COLUMN IF NOT EXISTS nurse_name text,
  ADD COLUMN IF NOT EXISTS sent_home text,
  ADD COLUMN IF NOT EXISTS called_home text;

COMMENT ON COLUMN public.health_center_admissions.treatment IS 'Treatment provided (e.g. Ice, Bandaged, Going home)';
COMMENT ON COLUMN public.health_center_admissions.incident_location IS 'Location of incident (e.g. Pool, Gaga, Bunk)';
COMMENT ON COLUMN public.health_center_admissions.group_name IS 'Camper group / bunk name at time of visit';
COMMENT ON COLUMN public.health_center_admissions.counselor_name IS 'Counselor name at time of visit';
COMMENT ON COLUMN public.health_center_admissions.nurse_name IS 'Nurse who logged the visit';
COMMENT ON COLUMN public.health_center_admissions.sent_home IS 'Yes / No / blank';
COMMENT ON COLUMN public.health_center_admissions.called_home IS 'Yes / No / N/A / other parent contact note';
