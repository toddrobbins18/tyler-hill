-- ==================================================
-- SECURITY FIX: Drop overly permissive profiles policy
-- ==================================================

-- Drop the policy that allows any authenticated user to view ALL profiles
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- ==================================================
-- SECURITY FIX: Add company-level isolation to audit_logs
-- ==================================================

-- Add company_id column to audit_logs for multi-tenant isolation
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON public.audit_logs(company_id);

-- Drop the existing overly permissive policy
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;

-- Create new company-scoped policy for admins
CREATE POLICY "Admins can view audit logs from their company"
ON public.audit_logs
FOR SELECT
USING (
  (has_role(auth.uid(), 'admin'::app_role) AND company_id = get_user_company(auth.uid()))
  OR is_super_admin(auth.uid())
);

-- Update the log_audit function to capture company_id
CREATE OR REPLACE FUNCTION public.log_audit()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  source_company_id uuid;
BEGIN
  -- Try to get company_id from the record if it exists
  BEGIN
    IF TG_OP = 'DELETE' THEN
      source_company_id := OLD.company_id;
    ELSE
      source_company_id := NEW.company_id;
    END IF;
  EXCEPTION WHEN undefined_column THEN
    source_company_id := NULL;
  END;

  IF TG_OP = 'DELETE' THEN
    INSERT INTO public.audit_logs (user_id, table_name, record_id, action, old_data, new_data, company_id)
    VALUES (auth.uid(), TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD), NULL, source_company_id);
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.audit_logs (user_id, table_name, record_id, action, old_data, new_data, company_id)
    VALUES (auth.uid(), TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW), source_company_id);
    RETURN NEW;
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO public.audit_logs (user_id, table_name, record_id, action, old_data, new_data, company_id)
    VALUES (auth.uid(), TG_TABLE_NAME, NEW.id, TG_OP, NULL, row_to_json(NEW), source_company_id);
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

-- ==================================================
-- SECURITY FIX: Update storage policies with company isolation
-- ==================================================

-- Drop existing overly permissive storage policies
DROP POLICY IF EXISTS "Company members can view daily wolf documents" ON storage.objects;
DROP POLICY IF EXISTS "Company members can upload daily wolf documents" ON storage.objects;
DROP POLICY IF EXISTS "Company members can update daily wolf documents" ON storage.objects;
DROP POLICY IF EXISTS "Company members can delete daily wolf documents" ON storage.objects;

DROP POLICY IF EXISTS "Company members can view rainy day documents" ON storage.objects;
DROP POLICY IF EXISTS "Company members can upload rainy day documents" ON storage.objects;
DROP POLICY IF EXISTS "Company members can update rainy day documents" ON storage.objects;
DROP POLICY IF EXISTS "Company members can delete rainy day documents" ON storage.objects;

-- Create company-scoped storage policies for daily-wolf-documents
-- Files must be stored as: <company_id>/<filename>
CREATE POLICY "Users can view their company daily wolf documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'daily-wolf-documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can upload their company daily wolf documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'daily-wolf-documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update their company daily wolf documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'daily-wolf-documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete their company daily wolf documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'daily-wolf-documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

-- Create company-scoped storage policies for rainy-day-documents
CREATE POLICY "Users can view their company rainy day documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'rainy-day-documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can upload their company rainy day documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'rainy-day-documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update their company rainy day documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'rainy-day-documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete their company rainy day documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'rainy-day-documents'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

-- Create company-scoped storage policies for profile-photos bucket
DROP POLICY IF EXISTS "Users can view profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete profile photos" ON storage.objects;

CREATE POLICY "Users can view their company profile photos"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'profile-photos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can upload their company profile photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'profile-photos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can update their company profile photos"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'profile-photos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
  )
);

CREATE POLICY "Users can delete their company profile photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'profile-photos'
  AND auth.role() = 'authenticated'
  AND (storage.foldername(name))[1] = (
    SELECT company_id::text FROM public.profiles WHERE id = auth.uid()
  )
);