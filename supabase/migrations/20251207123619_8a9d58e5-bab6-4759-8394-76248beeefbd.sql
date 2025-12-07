-- Fix master_calendar: Remove overly permissive policy
DROP POLICY IF EXISTS "Everyone can view master calendar" ON public.master_calendar;

-- Fix health_center_admissions: Remove staff access, keep only health_center and admin
DROP POLICY IF EXISTS "Staff and admin can manage health admissions" ON public.health_center_admissions;
DROP POLICY IF EXISTS "Admins and staff can manage health center admissions for their company" ON public.health_center_admissions;