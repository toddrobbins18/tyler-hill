-- Medication CSV imports defaulted to upload date; move pre-season starts to program open (June 25).

UPDATE public.medication_logs ml
SET date = (ml.season || '-06-25')::date
WHERE ml.season ~ '^\d{4}$'
  AND ml.date < (ml.season || '-06-25')::date;
