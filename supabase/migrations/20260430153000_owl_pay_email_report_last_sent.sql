-- Track last time a staff purchase report was sent per company.
ALTER TABLE public.owl_pay_email_config
ADD COLUMN IF NOT EXISTS last_staff_report_sent_at timestamptz;
