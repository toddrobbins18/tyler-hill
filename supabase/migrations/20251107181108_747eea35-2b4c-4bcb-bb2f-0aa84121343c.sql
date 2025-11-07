-- Create storage bucket for daily wolf documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('daily-wolf-documents', 'daily-wolf-documents', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage bucket for rainy day documents
INSERT INTO storage.buckets (id, name, public)
VALUES ('rainy-day-documents', 'rainy-day-documents', true)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies for daily-wolf-documents bucket
CREATE POLICY "Users can upload daily wolf documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'daily-wolf-documents');

CREATE POLICY "Users can view daily wolf documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'daily-wolf-documents');

CREATE POLICY "Users can delete daily wolf documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'daily-wolf-documents');

-- RLS Policies for rainy-day-documents bucket
CREATE POLICY "Users can upload rainy day documents"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'rainy-day-documents');

CREATE POLICY "Users can view rainy day documents"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'rainy-day-documents');

CREATE POLICY "Users can delete rainy day documents"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'rainy-day-documents');