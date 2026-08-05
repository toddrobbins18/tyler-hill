-- Create Office Transport Changes table for Tyler Hill multi-tenant setup

CREATE TABLE IF NOT EXISTS public.office_transport_changes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  change_date date NOT NULL DEFAULT CURRENT_DATE,
  camper_name text NOT NULL,
  camper_id uuid REFERENCES public.children(id) ON DELETE SET NULL,
  group_division text,
  note text NOT NULL,
  done boolean NOT NULL DEFAULT false,
  logged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  notified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.office_transport_changes TO authenticated;
GRANT ALL ON public.office_transport_changes TO service_role;

-- RLS
ALTER TABLE public.office_transport_changes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can manage office transport changes" ON public.office_transport_changes;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

CREATE POLICY "Users can manage office transport changes" 
  ON public.office_transport_changes 
  FOR ALL 
  USING (company_id = public.get_user_company(auth.uid()));

-- Updated_at trigger
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'trg_office_transport_changes_updated_at' 
    AND tgrelid = 'public.office_transport_changes'::regclass
  ) THEN
    CREATE TRIGGER trg_office_transport_changes_updated_at
      BEFORE UPDATE ON public.office_transport_changes
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_office_transport_changes_date ON public.office_transport_changes(change_date DESC);
CREATE INDEX IF NOT EXISTS idx_office_transport_changes_done ON public.office_transport_changes(done);
CREATE INDEX IF NOT EXISTS idx_office_transport_changes_company ON public.office_transport_changes(company_id);
