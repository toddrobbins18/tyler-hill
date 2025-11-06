-- Create junction tables for multiple divisions support

-- Activities & Field Trips - Divisions junction table
CREATE TABLE activities_field_trips_divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id UUID NOT NULL REFERENCES activities_field_trips(id) ON DELETE CASCADE,
  division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(activity_id, division_id)
);

-- Enable RLS
ALTER TABLE activities_field_trips_divisions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for activities_field_trips_divisions
CREATE POLICY "Users can view activity divisions from their company"
ON activities_field_trips_divisions
FOR SELECT
TO authenticated
USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage activity divisions for their company"
ON activities_field_trips_divisions
FOR ALL
TO authenticated
USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)))
WITH CHECK (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

-- Special Events - Divisions junction table
CREATE TABLE special_events_divisions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES special_events_activities(id) ON DELETE CASCADE,
  division_id UUID NOT NULL REFERENCES divisions(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES companies(id),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(event_id, division_id)
);

-- Enable RLS
ALTER TABLE special_events_divisions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for special_events_divisions
CREATE POLICY "Users can view special event divisions from their company"
ON special_events_divisions
FOR SELECT
TO authenticated
USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage special event divisions for their company"
ON special_events_divisions
FOR ALL
TO authenticated
USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)))
WITH CHECK (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

-- Add home_away field to activities_field_trips
ALTER TABLE activities_field_trips 
ADD COLUMN home_away TEXT CHECK (home_away IN ('home', 'away'));

-- Migrate existing single-division data to junction tables
INSERT INTO activities_field_trips_divisions (activity_id, division_id, company_id)
SELECT id, division_id, company_id 
FROM activities_field_trips 
WHERE division_id IS NOT NULL;

INSERT INTO special_events_divisions (event_id, division_id, company_id)
SELECT id, division_id, company_id 
FROM special_events_activities 
WHERE division_id IS NOT NULL;