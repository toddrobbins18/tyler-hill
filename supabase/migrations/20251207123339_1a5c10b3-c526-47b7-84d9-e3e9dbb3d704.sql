-- =====================================================
-- SECURITY FIX MIGRATION - PART 1
-- Add company_id to master_calendar first
-- =====================================================

-- 1. Add company_id to master_calendar
ALTER TABLE public.master_calendar ADD COLUMN company_id uuid REFERENCES public.companies(id);

-- Backfill company_id from division_id
UPDATE public.master_calendar mc
SET company_id = d.company_id
FROM public.divisions d
WHERE mc.division_id = d.id AND mc.company_id IS NULL;