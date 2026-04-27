-- Align write RLS with read RLS for activities / trips.
--
-- Problem: SELECT policies allow is_super_admin(auth.uid()), but FOR ALL write policies
-- only allowed company_id = get_user_company(auth.uid()). Super-admins who switch camp
-- in the app insert rows for currentCompany.id while get_user_company() still returns
-- profiles.company_id — WITH CHECK fails ("new row violates row-level security policy").
-- Browsers often show this as HTTP 400 on the REST request.

-- activities_field_trips
DROP POLICY IF EXISTS "Admins can manage field trips for their company" ON public.activities_field_trips;

CREATE POLICY "Admins can manage field trips for their company"
ON public.activities_field_trips
FOR ALL
USING (
  is_super_admin(auth.uid())
  OR (
    company_id = get_user_company(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
    )
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    company_id = get_user_company(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
    )
  )
);

-- activities_field_trips_divisions (same pattern; super-admin inserts links after activity create)
DROP POLICY IF EXISTS "Admins can manage activity divisions for their company" ON public.activities_field_trips_divisions;

CREATE POLICY "Admins can manage activity divisions for their company"
ON public.activities_field_trips_divisions
FOR ALL
TO authenticated
USING (
  is_super_admin(auth.uid())
  OR (
    company_id = get_user_company(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
    )
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    company_id = get_user_company(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
    )
  )
);

-- trips (web creates a pending trip after activity insert when not HOME)
DROP POLICY IF EXISTS "Admins can manage trips for their company" ON public.trips;

CREATE POLICY "Admins can manage trips for their company"
ON public.trips
FOR ALL
USING (
  is_super_admin(auth.uid())
  OR (
    company_id = get_user_company(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
    )
  )
)
WITH CHECK (
  is_super_admin(auth.uid())
  OR (
    company_id = get_user_company(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
    )
  )
);
