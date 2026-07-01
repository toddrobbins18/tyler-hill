-- Track medication refusals separately from administered medications.
ALTER TABLE public.medication_logs
  ADD COLUMN IF NOT EXISTS refused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS refused_by uuid REFERENCES public.staff(id),
  ADD COLUMN IF NOT EXISTS refused_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_medication_logs_refused
  ON public.medication_logs (company_id, season, date, refused);
