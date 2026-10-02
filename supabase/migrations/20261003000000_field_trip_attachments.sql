-- Receipts, invoices, and other files on field trips / activities (matches special_events_activities).

ALTER TABLE public.activities_field_trips
  ADD COLUMN IF NOT EXISTS file_url TEXT,
  ADD COLUMN IF NOT EXISTS file_name TEXT;

COMMENT ON COLUMN public.activities_field_trips.file_url IS 'Signed URL for attached receipt, invoice, or document';
COMMENT ON COLUMN public.activities_field_trips.file_name IS 'Original filename for display';
