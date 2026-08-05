-- Create Sunshine Report tables for Tyler Hill multi-tenant setup

CREATE TABLE IF NOT EXISTS public.sunshine_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(company_id, name)
);

CREATE TABLE IF NOT EXISTS public.sunshine_campers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  group_id UUID REFERENCES public.sunshine_groups(id) ON DELETE SET NULL,
  full_name TEXT NOT NULL,
  parent_email TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sunshine_tag_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('sport', 'activity', 'lunch')),
  label TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'gray',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.sunshine_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  camper_id UUID NOT NULL REFERENCES public.sunshine_campers(id) ON DELETE CASCADE,
  report_date DATE NOT NULL DEFAULT CURRENT_DATE,
  sports TEXT[] NOT NULL DEFAULT '{}',
  activities TEXT[] NOT NULL DEFAULT '{}',
  lunch TEXT[] NOT NULL DEFAULT '{}',
  bm BOOLEAN NOT NULL DEFAULT false,
  napped BOOLEAN NOT NULL DEFAULT false,
  send_email BOOLEAN NOT NULL DEFAULT true,
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(camper_id, report_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_sunshine_reports_date ON public.sunshine_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_sunshine_campers_group ON public.sunshine_campers(group_id);

-- RLS
ALTER TABLE public.sunshine_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sunshine_campers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sunshine_tag_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sunshine_reports ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to allow safe re-runs)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can manage sunshine_groups" ON public.sunshine_groups;
    DROP POLICY IF EXISTS "Users can manage sunshine_campers" ON public.sunshine_campers;
    DROP POLICY IF EXISTS "Users can manage sunshine_tag_options" ON public.sunshine_tag_options;
    DROP POLICY IF EXISTS "Users can manage sunshine_reports" ON public.sunshine_reports;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

-- Policies (Scoped by company)
CREATE POLICY "Users can manage sunshine_groups" ON public.sunshine_groups FOR ALL USING (company_id = public.get_user_company(auth.uid()));
CREATE POLICY "Users can manage sunshine_campers" ON public.sunshine_campers FOR ALL USING (company_id = public.get_user_company(auth.uid()));
CREATE POLICY "Users can manage sunshine_tag_options" ON public.sunshine_tag_options FOR ALL USING (company_id = public.get_user_company(auth.uid()));
CREATE POLICY "Users can manage sunshine_reports" ON public.sunshine_reports FOR ALL USING (company_id = public.get_user_company(auth.uid()));

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_sunshine_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_sunshine_reports_updated_at' 
    AND tgrelid = 'public.sunshine_reports'::regclass
  ) THEN
    CREATE TRIGGER update_sunshine_reports_updated_at
      BEFORE UPDATE ON public.sunshine_reports
      FOR EACH ROW
      EXECUTE FUNCTION update_sunshine_reports_updated_at();
  END IF;
END $$;
