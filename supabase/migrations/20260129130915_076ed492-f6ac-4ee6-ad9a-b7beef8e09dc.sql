-- Make the bucket private
UPDATE storage.buckets 
SET public = false 
WHERE id = 'profile-photos';

-- Drop the existing public read policy
DROP POLICY IF EXISTS "Public read access for profile photos" ON storage.objects;

-- Add authenticated-only read policy
CREATE POLICY "Authenticated users can view profile photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'profile-photos');