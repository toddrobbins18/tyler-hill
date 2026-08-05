-- Create Nurse Records table for Tyler Hill multi-tenant setup

CREATE TABLE IF NOT EXISTS public.nurse_records (
  id uuid primary key default gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  date date,
  camper_name text,
  reason text,
  reason_other text,
  treatment text,
  treatment_other text,
  location_of_incident text,
  group_name text,
  counselor text,
  nurse_name text,
  sent_home boolean default false,
  called_home boolean default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nurse_records TO authenticated;
GRANT ALL ON public.nurse_records TO service_role;
ALTER TABLE public.nurse_records ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can manage nurse records" ON public.nurse_records;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

CREATE POLICY "Users can manage nurse records" 
  ON public.nurse_records 
  FOR ALL 
  USING (company_id = public.get_user_company(auth.uid()));

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_nurse_records_updated_at' 
    AND tgrelid = 'public.nurse_records'::regclass
  ) THEN
    CREATE TRIGGER update_nurse_records_updated_at
      BEFORE UPDATE ON public.nurse_records
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_nurse_records_company ON public.nurse_records(company_id);
CREATE INDEX IF NOT EXISTS idx_nurse_records_date ON public.nurse_records(date DESC);


-- Create Nurse In/Out table for Tyler Hill multi-tenant setup

CREATE TABLE IF NOT EXISTS public.nurse_in_out (
  id uuid primary key default gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  date date,
  camper_name text,
  time_in time,
  time_out time,
  reason text,
  nurse_name text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.nurse_in_out TO authenticated;
GRANT ALL ON public.nurse_in_out TO service_role;
ALTER TABLE public.nurse_in_out ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can manage nurse in/out" ON public.nurse_in_out;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

CREATE POLICY "Users can manage nurse in/out" 
  ON public.nurse_in_out 
  FOR ALL 
  USING (company_id = public.get_user_company(auth.uid()));

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_nurse_in_out_updated_at' 
    AND tgrelid = 'public.nurse_in_out'::regclass
  ) THEN
    CREATE TRIGGER update_nurse_in_out_updated_at
      BEFORE UPDATE ON public.nurse_in_out
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_nurse_in_out_company ON public.nurse_in_out(company_id);
CREATE INDEX IF NOT EXISTS idx_nurse_in_out_date ON public.nurse_in_out(date DESC);
