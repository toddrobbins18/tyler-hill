-- Drop the overly permissive policies that don't filter by company
DROP POLICY IF EXISTS "Admins and staff can view evaluation questions" ON evaluation_questions;
DROP POLICY IF EXISTS "Only admins can manage evaluation questions" ON evaluation_questions;

-- The remaining policies already properly filter by company:
-- ✅ "Admins can manage evaluation questions in their company" (filters by company_id)
-- ✅ "Users can view evaluation questions from their company" (filters by company_id)
-- ✅ Super admins can still view/manage all (existing policies handle this)