-- Add company_id to children table
ALTER TABLE public.children 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

CREATE INDEX IF NOT EXISTS idx_children_company_id ON public.children(company_id);

-- Add company_id to staff table
ALTER TABLE public.staff 
ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id);

CREATE INDEX IF NOT EXISTS idx_staff_company_id ON public.staff(company_id);

-- Assign existing children to default company
UPDATE public.children
SET company_id = (SELECT id FROM public.companies WHERE slug = 'default')
WHERE company_id IS NULL;

-- Assign existing staff to default company
UPDATE public.staff
SET company_id = (SELECT id FROM public.companies WHERE slug = 'default')
WHERE company_id IS NULL;