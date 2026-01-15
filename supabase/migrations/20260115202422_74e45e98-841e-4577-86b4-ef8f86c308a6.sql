-- Add CampMinder bunk ID column for mapping
ALTER TABLE public.bunks 
ADD COLUMN IF NOT EXISTS cm_bunk_id INTEGER;

-- Create index for faster lookups during sync
CREATE INDEX IF NOT EXISTS idx_bunks_cm_bunk_id ON public.bunks(cm_bunk_id);

-- Add unique constraint per company to prevent duplicate CM bunks
CREATE UNIQUE INDEX IF NOT EXISTS idx_bunks_cm_bunk_id_company 
ON public.bunks(cm_bunk_id, company_id) WHERE cm_bunk_id IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.bunks.cm_bunk_id IS 'CampMinder bunk ID for automatic sync mapping';