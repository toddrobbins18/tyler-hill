-- Create Bunking Boards table for Tyler Hill multi-tenant setup

CREATE TABLE IF NOT EXISTS public.bunking_boards (
  company_id UUID PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  data JSONB NOT NULL DEFAULT '[]'::jsonb,
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bunking_boards TO authenticated;
GRANT ALL ON public.bunking_boards TO service_role;

-- RLS
ALTER TABLE public.bunking_boards ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can manage bunking boards" ON public.bunking_boards;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

CREATE POLICY "Users can manage bunking boards" 
  ON public.bunking_boards 
  FOR ALL 
  USING (company_id = public.get_user_company(auth.uid()));

-- Updated_at trigger
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_bunking_boards_updated_at' 
    AND tgrelid = 'public.bunking_boards'::regclass
  ) THEN
    CREATE TRIGGER update_bunking_boards_updated_at
      BEFORE UPDATE ON public.bunking_boards
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Enable realtime so all clients see live moves
ALTER TABLE public.bunking_boards REPLICA IDENTITY FULL;

DO $$
BEGIN
  -- This might throw if the table is already in the publication, so wrap in EXCEPTION
  ALTER PUBLICATION supabase_realtime ADD TABLE public.bunking_boards;
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
