-- Optional: add company_id to messages for future multi-camp inbox filtering.
-- Automated emails work without this column (company is resolved via recipient profile).

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL;

ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS sender_display_name text;

NOTIFY pgrst, 'reload schema';
