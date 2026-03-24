
-- Add balance column to children table for Owl Pay
ALTER TABLE public.children ADD COLUMN IF NOT EXISTS owl_pay_balance numeric NOT NULL DEFAULT 0;

-- Owl Pay Items (canteen menu items with prices)
CREATE TABLE public.owl_pay_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric NOT NULL DEFAULT 0,
  category text NOT NULL DEFAULT 'snacks',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.owl_pay_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view owl pay items from their company"
  ON public.owl_pay_items FOR SELECT TO authenticated
  USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage owl pay items"
  ON public.owl_pay_items FOR ALL TO authenticated
  USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')))
  WITH CHECK (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')));

-- Owl Pay Transactions
CREATE TABLE public.owl_pay_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  child_id uuid REFERENCES public.children(id) ON DELETE SET NULL,
  item_id uuid REFERENCES public.owl_pay_items(id) ON DELETE SET NULL,
  amount numeric NOT NULL DEFAULT 0,
  is_free boolean NOT NULL DEFAULT false,
  transaction_type text NOT NULL DEFAULT 'purchase',
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.owl_pay_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view owl pay transactions from their company"
  ON public.owl_pay_transactions FOR SELECT TO authenticated
  USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins and staff can manage owl pay transactions"
  ON public.owl_pay_transactions FOR ALL TO authenticated
  USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')))
  WITH CHECK (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')));

-- Owl Pay Daily Scans (track first scan free)
CREATE TABLE public.owl_pay_daily_scans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  child_id uuid NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  scan_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(company_id, child_id, scan_date)
);

ALTER TABLE public.owl_pay_daily_scans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view daily scans from their company"
  ON public.owl_pay_daily_scans FOR SELECT TO authenticated
  USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins and staff can manage daily scans"
  ON public.owl_pay_daily_scans FOR ALL TO authenticated
  USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')))
  WITH CHECK (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff')));
