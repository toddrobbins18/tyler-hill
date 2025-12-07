-- =====================================================
-- SECURITY FIX MIGRATION - PART 2
-- Fix RLS policies for sensitive data
-- =====================================================

-- 1. FIX MASTER_CALENDAR: Cross-company visibility leak
DROP POLICY IF EXISTS "Authenticated users can view calendar events" ON public.master_calendar;

CREATE POLICY "Users can view calendar events from their company"
ON public.master_calendar
FOR SELECT
USING (
  (company_id IS NULL) 
  OR (company_id = get_user_company(auth.uid())) 
  OR is_super_admin(auth.uid())
);

-- 2. FIX ROLE_PERMISSIONS: Was visible to all authenticated users
DROP POLICY IF EXISTS "Authenticated users can view role permissions" ON public.role_permissions;

CREATE POLICY "Users can view role permissions from their company"
ON public.role_permissions
FOR SELECT
USING ((company_id = get_user_company(auth.uid())) OR is_super_admin(auth.uid()));

-- 3. RESTRICT MEDICATION_LOGS: Only health_center and admin roles
DROP POLICY IF EXISTS "Users can view medication logs from their company" ON public.medication_logs;
DROP POLICY IF EXISTS "Admins can manage medication logs for their company" ON public.medication_logs;

CREATE POLICY "Health center and admins can view medication logs"
ON public.medication_logs
FOR SELECT
USING (
  (company_id = get_user_company(auth.uid())) 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'health_center'::app_role)
    OR is_super_admin(auth.uid())
  )
);

CREATE POLICY "Health center and admins can manage medication logs"
ON public.medication_logs
FOR ALL
USING (
  (company_id = get_user_company(auth.uid())) 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'health_center'::app_role)
  )
);

-- 4. RESTRICT HEALTH_CENTER_ADMISSIONS: Only health_center and admin roles
DROP POLICY IF EXISTS "Users can view health center admissions from their company" ON public.health_center_admissions;
DROP POLICY IF EXISTS "Admins can manage health center admissions for their company" ON public.health_center_admissions;

CREATE POLICY "Health center and admins can view health admissions"
ON public.health_center_admissions
FOR SELECT
USING (
  (company_id = get_user_company(auth.uid())) 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'health_center'::app_role)
    OR is_super_admin(auth.uid())
  )
);

CREATE POLICY "Health center and admins can manage health admissions"
ON public.health_center_admissions
FOR ALL
USING (
  (company_id = get_user_company(auth.uid())) 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'health_center'::app_role)
  )
);

-- 5. RESTRICT INCIDENT_REPORTS: Admins, health_center, and staff for read access
DROP POLICY IF EXISTS "Users can view incidents from their company" ON public.incident_reports;

CREATE POLICY "Authorized roles can view incidents"
ON public.incident_reports
FOR SELECT
USING (
  (company_id = get_user_company(auth.uid())) 
  AND (
    has_role(auth.uid(), 'admin'::app_role) 
    OR has_role(auth.uid(), 'health_center'::app_role)
    OR has_role(auth.uid(), 'staff'::app_role)
    OR is_super_admin(auth.uid())
  )
);

-- 6. RESTRICT PROFILES: Users can only see their own profile or admins can see all
DROP POLICY IF EXISTS "Users can view profiles from their company" ON public.profiles;

CREATE POLICY "Users view own profile admins view all"
ON public.profiles
FOR SELECT
USING (
  (id = auth.uid()) 
  OR (
    (company_id = get_user_company(auth.uid())) 
    AND has_role(auth.uid(), 'admin'::app_role)
  )
  OR is_super_admin(auth.uid())
);