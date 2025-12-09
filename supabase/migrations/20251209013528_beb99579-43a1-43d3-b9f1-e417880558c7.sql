-- Add unique constraint for upsert on children table
-- First, check if constraint exists and handle duplicates
DO $$
BEGIN
  -- Check if constraint doesn't already exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'children_company_person_season_unique'
  ) THEN
    -- Create unique constraint
    ALTER TABLE children 
    ADD CONSTRAINT children_company_person_season_unique 
    UNIQUE (company_id, person_id, season);
  END IF;
END $$;

-- Create sync_jobs table for tracking sync progress
CREATE TABLE IF NOT EXISTS sync_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL DEFAULT 'campminder',
  status TEXT NOT NULL DEFAULT 'pending',
  progress JSONB DEFAULT '{}'::jsonb,
  total_counts JSONB DEFAULT '{}'::jsonb,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_sync_jobs_company_id ON sync_jobs(company_id);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_status ON sync_jobs(status);
CREATE INDEX IF NOT EXISTS idx_sync_jobs_created_at ON sync_jobs(created_at DESC);

-- Enable RLS
ALTER TABLE sync_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies for sync_jobs
CREATE POLICY "Admins can manage sync jobs for their company"
ON sync_jobs FOR ALL
USING (
  (company_id = get_user_company(auth.uid()) AND has_role(auth.uid(), 'admin'::app_role))
);

CREATE POLICY "Super admins can manage all sync jobs"
ON sync_jobs FOR ALL
USING (is_super_admin(auth.uid()));

CREATE POLICY "Users can view sync jobs from their company"
ON sync_jobs FOR SELECT
USING (
  (company_id = get_user_company(auth.uid())) OR is_super_admin(auth.uid())
);

-- Add unique constraint on staff table for upsert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'staff_company_person_season_unique'
  ) THEN
    ALTER TABLE staff 
    ADD CONSTRAINT staff_company_person_season_unique 
    UNIQUE (company_id, person_id, season);
  END IF;
END $$;