-- Create trip_attachments table for storing itineraries and bus confirmations
CREATE TABLE public.trip_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  trip_id UUID NOT NULL REFERENCES public.trips(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_type TEXT, -- e.g., 'itinerary', 'bus_confirmation', 'other'
  uploaded_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.trip_attachments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view trip attachments from their company"
  ON public.trip_attachments
  FOR SELECT
  USING ((company_id = get_user_company(auth.uid())) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins and staff can manage trip attachments for their company"
  ON public.trip_attachments
  FOR ALL
  USING ((company_id = get_user_company(auth.uid())) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

-- Create index for faster lookups
CREATE INDEX idx_trip_attachments_trip_id ON public.trip_attachments(trip_id);
CREATE INDEX idx_trip_attachments_company_id ON public.trip_attachments(company_id);

-- Create storage bucket for trip attachments
INSERT INTO storage.buckets (id, name, public) 
VALUES ('trip-attachments', 'trip-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for trip attachments
CREATE POLICY "Anyone can view trip attachments"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'trip-attachments');

CREATE POLICY "Authenticated users can upload trip attachments"
  ON storage.objects
  FOR INSERT
  WITH CHECK (bucket_id = 'trip-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Users can update their own trip attachments"
  ON storage.objects
  FOR UPDATE
  USING (bucket_id = 'trip-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Users can delete their own trip attachments"
  ON storage.objects
  FOR DELETE
  USING (bucket_id = 'trip-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);