-- Add new columns to evaluation_questions table
ALTER TABLE evaluation_questions
  ADD COLUMN company_id UUID REFERENCES companies(id),
  ADD COLUMN staff_type TEXT CHECK (staff_type IN ('specialist', 'general_counselor', 'both')),
  ADD COLUMN evaluated_by TEXT,
  ADD COLUMN guidance_text TEXT,
  ADD COLUMN display_order INTEGER;

-- Drop existing policies
DROP POLICY IF EXISTS "Admins and supervisors can manage evaluation responses" ON evaluation_questions;
DROP POLICY IF EXISTS "Admins and supervisors can view evaluation responses" ON evaluation_questions;

-- Create new RLS policies for company isolation
CREATE POLICY "Users can view evaluation questions from their company"
  ON evaluation_questions FOR SELECT
  USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage evaluation questions in their company"
  ON evaluation_questions FOR ALL
  USING (company_id = get_user_company(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (company_id = get_user_company(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role));