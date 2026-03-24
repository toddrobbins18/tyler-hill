
CREATE TABLE public.owl_pay_email_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE NOT NULL,
  low_balance_alerts_enabled boolean NOT NULL DEFAULT false,
  low_balance_threshold numeric NOT NULL DEFAULT 5.00,
  low_balance_recipient_email text,
  staff_purchase_reports_enabled boolean NOT NULL DEFAULT false,
  staff_report_frequency text NOT NULL DEFAULT 'daily',
  staff_report_recipient_email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(company_id)
);

ALTER TABLE public.owl_pay_email_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own company config" ON public.owl_pay_email_config
  FOR SELECT TO authenticated
  USING (company_id = public.get_user_company(auth.uid()));

CREATE POLICY "Admins can manage config" ON public.owl_pay_email_config
  FOR ALL TO authenticated
  USING (company_id = public.get_user_company(auth.uid()) AND public.is_admin(auth.uid()))
  WITH CHECK (company_id = public.get_user_company(auth.uid()) AND public.is_admin(auth.uid()));
