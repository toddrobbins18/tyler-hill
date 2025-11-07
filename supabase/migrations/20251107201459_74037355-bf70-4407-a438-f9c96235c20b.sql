-- Create table for Daily Wolf content (quotes and notes)
CREATE TABLE IF NOT EXISTS public.daily_wolf_content (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id),
  date DATE NOT NULL,
  quote_of_the_day TEXT,
  notes TEXT,
  season TEXT NOT NULL DEFAULT '2026',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(company_id, date, season)
);

-- Enable Row Level Security
ALTER TABLE public.daily_wolf_content ENABLE ROW LEVEL SECURITY;

-- Create policies for daily wolf content
CREATE POLICY "Admins can manage daily wolf content for their company"
ON public.daily_wolf_content
FOR ALL
USING (
  company_id = get_user_company(auth.uid())
  AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role))
);

CREATE POLICY "Users can view daily wolf content from their company"
ON public.daily_wolf_content
FOR SELECT
USING (
  company_id = get_user_company(auth.uid())
  OR is_super_admin(auth.uid())
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_daily_wolf_content_updated_at
BEFORE UPDATE ON public.daily_wolf_content
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();