-- Create Swim Lessons table for Tyler Hill multi-tenant setup

CREATE TABLE IF NOT EXISTS public.swim_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  camper_id UUID NOT NULL REFERENCES public.children(id) ON DELETE CASCADE,
  scheduled_at TIMESTAMPTZ NOT NULL,
  duration_minutes INT NOT NULL DEFAULT 30,
  instructor TEXT,
  location TEXT,
  cost_cents INT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'scheduled',
  parent_confirmed BOOLEAN NOT NULL DEFAULT false,
  parent_confirmed_at TIMESTAMPTZ,
  reminder_sent_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.swim_lessons TO authenticated;
GRANT ALL ON public.swim_lessons TO service_role;

-- RLS
ALTER TABLE public.swim_lessons ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    DROP POLICY IF EXISTS "Users can manage swim lessons" ON public.swim_lessons;
EXCEPTION
    WHEN OTHERS THEN
        NULL;
END $$;

CREATE POLICY "Users can manage swim lessons" 
  ON public.swim_lessons 
  FOR ALL 
  USING (company_id = public.get_user_company(auth.uid()));

-- Updated_at trigger
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger 
    WHERE tgname = 'update_swim_lessons_updated_at' 
    AND tgrelid = 'public.swim_lessons'::regclass
  ) THEN
    CREATE TRIGGER update_swim_lessons_updated_at
      BEFORE UPDATE ON public.swim_lessons
      FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_swim_lessons_scheduled ON public.swim_lessons(scheduled_at);
CREATE INDEX IF NOT EXISTS idx_swim_lessons_company ON public.swim_lessons(company_id);
CREATE INDEX IF NOT EXISTS idx_swim_lessons_camper ON public.swim_lessons(camper_id);
