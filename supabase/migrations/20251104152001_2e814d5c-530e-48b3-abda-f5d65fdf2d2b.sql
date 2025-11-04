-- Phase 1: Add company_id to all tables that need it
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
ALTER TABLE special_meals ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
ALTER TABLE rainy_day_schedule ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
ALTER TABLE sports_calendar ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
ALTER TABLE activities_field_trips ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
ALTER TABLE special_events_activities ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
ALTER TABLE trips ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
ALTER TABLE awards ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
ALTER TABLE daily_notes ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
ALTER TABLE events ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
ALTER TABLE health_center_admissions ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
ALTER TABLE medication_logs ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
ALTER TABLE tutoring_therapy ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
ALTER TABLE sports_academy ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
ALTER TABLE sports_event_roster ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
ALTER TABLE sports_event_staff ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
ALTER TABLE sports_calendar_divisions ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
ALTER TABLE roster_templates ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
ALTER TABLE roster_template_children ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
ALTER TABLE trip_attendees ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);
ALTER TABLE staff_evaluations ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES companies(id);

-- Phase 2: Update RLS policies to include company filtering

-- Menu Items
DROP POLICY IF EXISTS "Admins and staff can delete menu" ON menu_items;
DROP POLICY IF EXISTS "Admins and staff can manage menu" ON menu_items;
DROP POLICY IF EXISTS "Admins and staff can update menu" ON menu_items;
DROP POLICY IF EXISTS "Everyone can view menu" ON menu_items;

CREATE POLICY "Users can view menu from their company"
ON menu_items FOR SELECT
USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage menu for their company"
ON menu_items FOR ALL
USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

-- Special Meals
DROP POLICY IF EXISTS "Admins and staff can manage special meals" ON special_meals;
DROP POLICY IF EXISTS "Everyone can view special meals" ON special_meals;

CREATE POLICY "Users can view special meals from their company"
ON special_meals FOR SELECT
USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage special meals for their company"
ON special_meals FOR ALL
USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

-- Rainy Day Schedule
DROP POLICY IF EXISTS "Admins and staff can manage rainy day schedule" ON rainy_day_schedule;
DROP POLICY IF EXISTS "Everyone can view rainy day schedule" ON rainy_day_schedule;

CREATE POLICY "Users can view rainy day schedule from their company"
ON rainy_day_schedule FOR SELECT
USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage rainy day schedule for their company"
ON rainy_day_schedule FOR ALL
USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

-- Sports Calendar
DROP POLICY IF EXISTS "Admins and staff can manage sports calendar" ON sports_calendar;
DROP POLICY IF EXISTS "Everyone can view sports calendar" ON sports_calendar;

CREATE POLICY "Users can view sports calendar from their company"
ON sports_calendar FOR SELECT
USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage sports calendar for their company"
ON sports_calendar FOR ALL
USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

-- Activities Field Trips
DROP POLICY IF EXISTS "Admins and staff can manage field trips" ON activities_field_trips;
DROP POLICY IF EXISTS "Everyone can view field trips" ON activities_field_trips;

CREATE POLICY "Users can view field trips from their company"
ON activities_field_trips FOR SELECT
USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage field trips for their company"
ON activities_field_trips FOR ALL
USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

-- Special Events Activities
DROP POLICY IF EXISTS "Admins and staff can manage daily schedule" ON special_events_activities;
DROP POLICY IF EXISTS "Everyone can view daily schedule" ON special_events_activities;

CREATE POLICY "Users can view special events from their company"
ON special_events_activities FOR SELECT
USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage special events for their company"
ON special_events_activities FOR ALL
USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

-- Trips
DROP POLICY IF EXISTS "Admins and staff can delete trips" ON trips;
DROP POLICY IF EXISTS "Admins and staff can manage trips" ON trips;
DROP POLICY IF EXISTS "Admins and staff can update trips" ON trips;
DROP POLICY IF EXISTS "Everyone can view trips" ON trips;

CREATE POLICY "Users can view trips from their company"
ON trips FOR SELECT
USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage trips for their company"
ON trips FOR ALL
USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

-- Awards
DROP POLICY IF EXISTS "Admins and staff can manage awards" ON awards;

CREATE POLICY "Users can view awards from their company"
ON awards FOR SELECT
USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage awards for their company"
ON awards FOR ALL
USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

-- Daily Notes
DROP POLICY IF EXISTS "Admins and staff can manage daily notes" ON daily_notes;

CREATE POLICY "Users can view daily notes from their company"
ON daily_notes FOR SELECT
USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage daily notes for their company"
ON daily_notes FOR ALL
USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

-- Events
DROP POLICY IF EXISTS "Admins and staff can manage events" ON events;

CREATE POLICY "Users can view events from their company"
ON events FOR SELECT
USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage events for their company"
ON events FOR ALL
USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

-- Incident Reports
DROP POLICY IF EXISTS "Admins and staff can manage incidents" ON incident_reports;

CREATE POLICY "Users can view incidents from their company"
ON incident_reports FOR SELECT
USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage incidents for their company"
ON incident_reports FOR ALL
USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

-- Health Center Admissions
DROP POLICY IF EXISTS "Admins and staff can manage health center admissions" ON health_center_admissions;
DROP POLICY IF EXISTS "Admins and staff can view health center admissions" ON health_center_admissions;

CREATE POLICY "Users can view health admissions from their company"
ON health_center_admissions FOR SELECT
USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage health admissions for their company"
ON health_center_admissions FOR ALL
USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

-- Medication Logs
DROP POLICY IF EXISTS "Admins and staff can manage medication logs" ON medication_logs;
DROP POLICY IF EXISTS "Admins and staff can view medication logs" ON medication_logs;

CREATE POLICY "Users can view medication logs from their company"
ON medication_logs FOR SELECT
USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage medication logs for their company"
ON medication_logs FOR ALL
USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

-- Tutoring Therapy
DROP POLICY IF EXISTS "Admins and staff can manage tutoring therapy" ON tutoring_therapy;
DROP POLICY IF EXISTS "Admins and staff can view tutoring therapy" ON tutoring_therapy;

CREATE POLICY "Users can view tutoring therapy from their company"
ON tutoring_therapy FOR SELECT
USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage tutoring therapy for their company"
ON tutoring_therapy FOR ALL
USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

-- Sports Academy
DROP POLICY IF EXISTS "Admins and staff can manage sports academy" ON sports_academy;
DROP POLICY IF EXISTS "Admins and staff can view sports academy" ON sports_academy;

CREATE POLICY "Users can view sports academy from their company"
ON sports_academy FOR SELECT
USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage sports academy for their company"
ON sports_academy FOR ALL
USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

-- Sports Event Roster
DROP POLICY IF EXISTS "Admins and staff can manage sports event rosters" ON sports_event_roster;
DROP POLICY IF EXISTS "Admins and staff can view sports event rosters" ON sports_event_roster;

CREATE POLICY "Users can view sports rosters from their company"
ON sports_event_roster FOR SELECT
USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage sports rosters for their company"
ON sports_event_roster FOR ALL
USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

-- Sports Event Staff
DROP POLICY IF EXISTS "Admins and staff can manage sports event staff" ON sports_event_staff;
DROP POLICY IF EXISTS "Everyone can view sports event staff" ON sports_event_staff;

CREATE POLICY "Users can view sports event staff from their company"
ON sports_event_staff FOR SELECT
USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage sports event staff for their company"
ON sports_event_staff FOR ALL
USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

-- Sports Calendar Divisions
DROP POLICY IF EXISTS "Admins and staff can manage sports calendar divisions" ON sports_calendar_divisions;
DROP POLICY IF EXISTS "Everyone can view sports calendar divisions" ON sports_calendar_divisions;

CREATE POLICY "Users can view sports calendar divisions from their company"
ON sports_calendar_divisions FOR SELECT
USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage sports calendar divisions for their company"
ON sports_calendar_divisions FOR ALL
USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

-- Roster Templates
DROP POLICY IF EXISTS "Admins and staff can manage roster templates" ON roster_templates;
DROP POLICY IF EXISTS "Everyone can view roster templates" ON roster_templates;

CREATE POLICY "Users can view roster templates from their company"
ON roster_templates FOR SELECT
USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage roster templates for their company"
ON roster_templates FOR ALL
USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

-- Roster Template Children
DROP POLICY IF EXISTS "Admins and staff can manage roster template children" ON roster_template_children;
DROP POLICY IF EXISTS "Everyone can view roster template children" ON roster_template_children;

CREATE POLICY "Users can view roster template children from their company"
ON roster_template_children FOR SELECT
USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage roster template children for their company"
ON roster_template_children FOR ALL
USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

-- Trip Attendees
DROP POLICY IF EXISTS "Admins and staff can manage trip attendees" ON trip_attendees;
DROP POLICY IF EXISTS "Admins and staff can view trip attendees" ON trip_attendees;

CREATE POLICY "Users can view trip attendees from their company"
ON trip_attendees FOR SELECT
USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage trip attendees for their company"
ON trip_attendees FOR ALL
USING (company_id = get_user_company(auth.uid()) AND (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'staff'::app_role)));

-- Staff Evaluations
DROP POLICY IF EXISTS "Admins can manage evaluations" ON staff_evaluations;
DROP POLICY IF EXISTS "Staff can view own evaluations" ON staff_evaluations;

CREATE POLICY "Users can view staff evaluations from their company"
ON staff_evaluations FOR SELECT
USING (company_id = get_user_company(auth.uid()) OR is_super_admin(auth.uid()));

CREATE POLICY "Admins can manage staff evaluations for their company"
ON staff_evaluations FOR ALL
USING (company_id = get_user_company(auth.uid()) AND is_admin(auth.uid()));