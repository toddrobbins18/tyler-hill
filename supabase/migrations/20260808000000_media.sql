-- Media library: camp photos + camp-media storage bucket (multi-tenant)

INSERT INTO storage.buckets (id, name, public)
VALUES ('camp-media', 'camp-media', true)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_url text NOT NULL,
  folder text DEFAULT 'All Photos',
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  tags text[],
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_company ON public.media(company_id);
CREATE INDEX IF NOT EXISTS idx_media_created_at ON public.media(created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.media TO authenticated;
GRANT ALL ON public.media TO service_role;

ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  DROP POLICY IF EXISTS "Users can manage media for their company" ON public.media;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "Users can manage media for their company"
  ON public.media
  FOR ALL
  USING (company_id = public.get_user_company(auth.uid()))
  WITH CHECK (company_id = public.get_user_company(auth.uid()));

-- Storage policies for camp-media bucket
DO $$
BEGIN
  DROP POLICY IF EXISTS "camp-media public read" ON storage.objects;
  DROP POLICY IF EXISTS "camp-media authenticated upload" ON storage.objects;
  DROP POLICY IF EXISTS "camp-media uploader delete" ON storage.objects;
  DROP POLICY IF EXISTS "Anyone can view camp media" ON storage.objects;
  DROP POLICY IF EXISTS "Authenticated users upload media" ON storage.objects;
  DROP POLICY IF EXISTS "Admins delete media" ON storage.objects;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

CREATE POLICY "camp-media public read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'camp-media');

CREATE POLICY "camp-media authenticated upload"
  ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'camp-media');

CREATE POLICY "camp-media uploader delete"
  ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'camp-media' AND auth.uid() = owner);

COMMENT ON TABLE public.media IS 'Camp media library uploads (photos) per company';
