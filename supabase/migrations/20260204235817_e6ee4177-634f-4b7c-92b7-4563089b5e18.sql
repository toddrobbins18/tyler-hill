
-- Create a helper function to check if user can access a child based on division
CREATE OR REPLACE FUNCTION public.can_access_child(_child_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.children c
    WHERE c.id = _child_id
      AND c.company_id = get_user_company(auth.uid())
      AND (
        -- Admins, staff, health_center can see all children
        has_role(auth.uid(), 'admin'::app_role)
        OR has_role(auth.uid(), 'staff'::app_role)
        OR has_role(auth.uid(), 'health_center'::app_role)
        -- Division-based roles can only see children in their divisions
        OR (
          (has_role(auth.uid(), 'division_leader'::app_role) 
           OR has_role(auth.uid(), 'specialist'::app_role) 
           OR has_role(auth.uid(), 'viewer'::app_role))
          AND c.division_id = ANY(get_user_divisions(auth.uid()))
        )
      )
  )
$$;

-- Update daily_notes SELECT policy
DROP POLICY IF EXISTS "Users can view daily notes from their company" ON public.daily_notes;
CREATE POLICY "Users can view daily notes from their company" 
ON public.daily_notes FOR SELECT 
USING (
  is_super_admin(auth.uid())
  OR (
    company_id = get_user_company(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR has_role(auth.uid(), 'health_center'::app_role)
      OR (child_id IS NOT NULL AND can_access_child(child_id))
    )
  )
);

-- Update awards SELECT policy
DROP POLICY IF EXISTS "Users can view awards from their company" ON public.awards;
CREATE POLICY "Users can view awards from their company" 
ON public.awards FOR SELECT 
USING (
  is_super_admin(auth.uid())
  OR (
    company_id = get_user_company(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR (child_id IS NOT NULL AND can_access_child(child_id))
    )
  )
);

-- Update camper_reports SELECT policy
DROP POLICY IF EXISTS "Users can view camper reports from their company" ON public.camper_reports;
CREATE POLICY "Users can view camper reports from their company" 
ON public.camper_reports FOR SELECT 
USING (
  is_super_admin(auth.uid())
  OR (
    company_id = get_user_company(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR can_access_child(child_id)
    )
  )
);

-- Update appointments SELECT policy  
DROP POLICY IF EXISTS "Users can view appointments for their company" ON public.appointments;
CREATE POLICY "Users can view appointments for their company" 
ON public.appointments FOR SELECT 
USING (
  is_super_admin(auth.uid())
  OR (
    company_id = get_user_company(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR has_role(auth.uid(), 'health_center'::app_role)
      OR (child_id IS NOT NULL AND can_access_child(child_id))
    )
  )
);

-- Update sports_academy SELECT policy (if it exists)
DROP POLICY IF EXISTS "Users can view sports academy from their company" ON public.sports_academy;
CREATE POLICY "Users can view sports academy from their company" 
ON public.sports_academy FOR SELECT 
USING (
  is_super_admin(auth.uid())
  OR (
    company_id = get_user_company(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR has_role(auth.uid(), 'specialist'::app_role)
      OR (child_id IS NOT NULL AND can_access_child(child_id))
    )
  )
);

-- Update tutoring_therapy SELECT policy (if it exists)
DROP POLICY IF EXISTS "Users can view tutoring therapy from their company" ON public.tutoring_therapy;
CREATE POLICY "Users can view tutoring therapy from their company" 
ON public.tutoring_therapy FOR SELECT 
USING (
  is_super_admin(auth.uid())
  OR (
    company_id = get_user_company(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR has_role(auth.uid(), 'specialist'::app_role)
      OR (child_id IS NOT NULL AND can_access_child(child_id))
    )
  )
);

-- Update trip_attendees SELECT policy
DROP POLICY IF EXISTS "Users can view trip attendees from their company" ON public.trip_attendees;
CREATE POLICY "Users can view trip attendees from their company" 
ON public.trip_attendees FOR SELECT 
USING (
  is_super_admin(auth.uid())
  OR (
    company_id = get_user_company(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR can_access_child(child_id)
    )
  )
);

-- Update sports_event_roster SELECT policy (if exists)
DROP POLICY IF EXISTS "Users can view sports event roster from their company" ON public.sports_event_roster;
CREATE POLICY "Users can view sports event roster from their company" 
ON public.sports_event_roster FOR SELECT 
USING (
  is_super_admin(auth.uid())
  OR (
    company_id = get_user_company(auth.uid())
    AND (
      has_role(auth.uid(), 'admin'::app_role)
      OR has_role(auth.uid(), 'staff'::app_role)
      OR has_role(auth.uid(), 'specialist'::app_role)
      OR can_access_child(child_id)
    )
  )
);
