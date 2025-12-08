-- Add person_id column to staff table for CampMinder sync
ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS person_id text;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_staff_person_id ON public.staff(person_id);
CREATE INDEX IF NOT EXISTS idx_staff_company_person ON public.staff(company_id, person_id);

-- Enable pg_cron and pg_net extensions for scheduled sync
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;