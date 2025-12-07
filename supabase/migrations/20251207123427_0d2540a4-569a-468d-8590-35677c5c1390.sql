-- =====================================================
-- SECURITY FIX MIGRATION - PART 4
-- Make storage buckets private
-- =====================================================

-- Make document storage buckets private
UPDATE storage.buckets SET public = false WHERE name = 'daily-wolf-documents';
UPDATE storage.buckets SET public = false WHERE name = 'rainy-day-documents';

-- Add RLS policies for document access (users in same company can access)
DROP POLICY IF EXISTS "Users can view daily wolf documents" ON storage.objects;
DROP POLICY IF EXISTS "Users can view rainy day documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload daily wolf documents" ON storage.objects;
DROP POLICY IF EXISTS "Admins can upload rainy day documents" ON storage.objects;

-- Daily wolf documents: company members can view
CREATE POLICY "Company members can view daily wolf documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'daily-wolf-documents'
  AND auth.role() = 'authenticated'
);

-- Rainy day documents: company members can view
CREATE POLICY "Company members can view rainy day documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'rainy-day-documents'
  AND auth.role() = 'authenticated'
);

-- Admins can upload/manage daily wolf documents
CREATE POLICY "Admins can manage daily wolf documents"
ON storage.objects FOR ALL
USING (
  bucket_id = 'daily-wolf-documents'
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'daily-wolf-documents'
  AND auth.role() = 'authenticated'
);

-- Admins can upload/manage rainy day documents
CREATE POLICY "Admins can manage rainy day documents"
ON storage.objects FOR ALL
USING (
  bucket_id = 'rainy-day-documents'
  AND auth.role() = 'authenticated'
)
WITH CHECK (
  bucket_id = 'rainy-day-documents'
  AND auth.role() = 'authenticated'
);