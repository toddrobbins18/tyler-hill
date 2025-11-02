-- Add super_admin role to existing app_role enum
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'super_admin') THEN
    ALTER TYPE app_role ADD VALUE 'super_admin';
  END IF;
END $$;

-- Create companies table
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  logo_url TEXT,
  theme_color TEXT NOT NULL DEFAULT '#000000',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

-- Add company_id to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);
CREATE INDEX IF NOT EXISTS idx_profiles_company_id ON public.profiles(company_id);

-- Create default company and assign to existing users (before RLS policies)
INSERT INTO public.companies (name, slug, theme_color, is_active)
VALUES ('Default Organization', 'default', '#000000', true)
ON CONFLICT (slug) DO NOTHING;

-- Assign all existing profiles to the default company
UPDATE public.profiles
SET company_id = (SELECT id FROM public.companies WHERE slug = 'default')
WHERE company_id IS NULL;