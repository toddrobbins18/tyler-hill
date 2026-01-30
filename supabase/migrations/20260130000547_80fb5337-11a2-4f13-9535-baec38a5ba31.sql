-- Create storage bucket for division schedules
INSERT INTO storage.buckets (id, name, public) 
VALUES ('division-schedules', 'division-schedules', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for division schedules bucket
CREATE POLICY "Authenticated users can view division schedules from their company"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'division-schedules' 
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = (SELECT id::text FROM public.profiles WHERE id = auth.uid() LIMIT 1)::text
);

CREATE POLICY "Admins and staff can upload division schedules"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'division-schedules' 
  AND auth.role() = 'authenticated'
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'))
);

CREATE POLICY "Admins can delete division schedules"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'division-schedules' 
  AND auth.role() = 'authenticated'
  AND has_role(auth.uid(), 'admin')
);