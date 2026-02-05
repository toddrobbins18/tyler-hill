-- Make trip-attachments bucket private and update RLS policies
UPDATE storage.buckets 
SET public = false 
WHERE id = 'trip-attachments';

-- Drop the overly permissive public SELECT policy
DROP POLICY IF EXISTS "Anyone can view trip attachments" ON storage.objects;

-- Create proper authenticated SELECT policy with company scoping
CREATE POLICY "Users can view their company trip attachments"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'trip-attachments'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
  )
);