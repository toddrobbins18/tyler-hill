-- Owl Pay: support staff-tab purchases without overloading child_id.
-- Safe/idempotent migration for shared schema.

ALTER TABLE public.owl_pay_transactions
ADD COLUMN IF NOT EXISTS staff_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'owl_pay_transactions_staff_id_fkey'
      AND conrelid = 'public.owl_pay_transactions'::regclass
  ) THEN
    ALTER TABLE public.owl_pay_transactions
    ADD CONSTRAINT owl_pay_transactions_staff_id_fkey
      FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_owl_pay_transactions_staff_id
  ON public.owl_pay_transactions(staff_id);

CREATE INDEX IF NOT EXISTS idx_owl_pay_transactions_company_staff_id
  ON public.owl_pay_transactions(company_id, staff_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'owl_pay_transactions_purchase_actor_check'
      AND conrelid = 'public.owl_pay_transactions'::regclass
  ) THEN
    ALTER TABLE public.owl_pay_transactions
    ADD CONSTRAINT owl_pay_transactions_purchase_actor_check
    CHECK (
      transaction_type <> 'purchase'
      OR ((CASE WHEN child_id IS NULL THEN 0 ELSE 1 END) + (CASE WHEN staff_id IS NULL THEN 0 ELSE 1 END) = 1)
    ) NOT VALID;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'owl_pay_transactions_first_scan_child_only_check'
      AND conrelid = 'public.owl_pay_transactions'::regclass
  ) THEN
    ALTER TABLE public.owl_pay_transactions
    ADD CONSTRAINT owl_pay_transactions_first_scan_child_only_check
    CHECK (
      transaction_type <> 'first_scan'
      OR (child_id IS NOT NULL AND staff_id IS NULL)
    ) NOT VALID;
  END IF;
END
$$;
