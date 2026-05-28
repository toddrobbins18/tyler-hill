-- Daily scheduled meds imported before recurring defaults should run through camp end (Aug 12).

UPDATE public.medication_logs
SET
  is_recurring = true,
  frequency = COALESCE(NULLIF(btrim(frequency), ''), 'daily'),
  end_date = COALESCE(end_date, (season || '-08-12')::date)
WHERE meal_time IS NOT NULL
  AND season ~ '^\d{4}$'
  AND (is_recurring IS NOT TRUE OR end_date IS NULL)
  AND date <= (season || '-08-12')::date;
