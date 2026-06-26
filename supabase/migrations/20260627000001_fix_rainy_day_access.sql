-- Fix role permissions for Division Leaders, Specialists, Viewers to access Rainy Day
INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT id, 'division_leader'::app_role, 'rainy-day', true FROM public.companies
ON CONFLICT (company_id, role, menu_item) DO UPDATE SET can_access = true;

INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT id, 'specialist'::app_role, 'rainy-day', true FROM public.companies
ON CONFLICT (company_id, role, menu_item) DO UPDATE SET can_access = true;

INSERT INTO public.role_permissions (company_id, role, menu_item, can_access)
SELECT id, 'viewer'::app_role, 'rainy-day', true FROM public.companies
ON CONFLICT (company_id, role, menu_item) DO UPDATE SET can_access = true;

-- Ensure storage policies check ALL companies the user has access to, not just their primary profiles.company_id
DROP POLICY IF EXISTS "Users can view their company daily wolf documents" ON storage.objects;
CREATE POLICY "Users can view their company daily wolf documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'daily-wolf-documents'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.company_id::text = (storage.foldername(name))[1]
  )
);

DROP POLICY IF EXISTS "Users can view their company rainy day documents" ON storage.objects;
CREATE POLICY "Users can view their company rainy day documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'rainy-day-documents'
  AND auth.role() = 'authenticated'
  AND EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.company_id::text = (storage.foldername(name))[1]
  )
);
