-- Create tables for document uploads

-- Daily Wolf documents table
CREATE TABLE IF NOT EXISTS daily_wolf_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  season TEXT NOT NULL DEFAULT '2026',
  date DATE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rainy Day documents table
CREATE TABLE IF NOT EXISTS rainy_day_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL,
  season TEXT NOT NULL DEFAULT '2026',
  date DATE NOT NULL,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  uploaded_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE daily_wolf_documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE rainy_day_documents ENABLE ROW LEVEL SECURITY;

-- RLS Policies for daily_wolf_documents
CREATE POLICY "Users can view daily wolf documents from their company"
  ON daily_wolf_documents FOR SELECT
  USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage daily wolf documents for their company"
  ON daily_wolf_documents FOR ALL
  USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

-- RLS Policies for rainy_day_documents
CREATE POLICY "Users can view rainy day documents from their company"
  ON rainy_day_documents FOR SELECT
  USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage rainy day documents for their company"
  ON rainy_day_documents FOR ALL
  USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));