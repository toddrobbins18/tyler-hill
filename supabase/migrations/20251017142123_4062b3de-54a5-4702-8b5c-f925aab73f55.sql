-- PHASE 1.1: Add season columns and meal columns

-- Add season column to all tables with default value '2026'
ALTER TABLE children ADD COLUMN IF NOT EXISTS season TEXT DEFAULT '2026';
ALTER TABLE trips ADD COLUMN IF NOT EXISTS season TEXT DEFAULT '2026';
ALTER TABLE sports_calendar ADD COLUMN IF NOT EXISTS season TEXT DEFAULT '2026';
ALTER TABLE activities_field_trips ADD COLUMN IF NOT EXISTS season TEXT DEFAULT '2026';
ALTER TABLE special_events_activities ADD COLUMN IF NOT EXISTS season TEXT DEFAULT '2026';
ALTER TABLE master_calendar ADD COLUMN IF NOT EXISTS season TEXT DEFAULT '2026';
ALTER TABLE daily_notes ADD COLUMN IF NOT EXISTS season TEXT DEFAULT '2026';
ALTER TABLE medication_logs ADD COLUMN IF NOT EXISTS season TEXT DEFAULT '2026';
ALTER TABLE awards ADD COLUMN IF NOT EXISTS season TEXT DEFAULT '2026';
ALTER TABLE incident_reports ADD COLUMN IF NOT EXISTS season TEXT DEFAULT '2026';
ALTER TABLE staff_evaluations ADD COLUMN IF NOT EXISTS season TEXT DEFAULT '2026';
ALTER TABLE sports_academy ADD COLUMN IF NOT EXISTS season TEXT DEFAULT '2026';
ALTER TABLE menu_items ADD COLUMN IF NOT EXISTS season TEXT DEFAULT '2026';
ALTER TABLE special_meals ADD COLUMN IF NOT EXISTS season TEXT DEFAULT '2026';
ALTER TABLE rainy_day_schedule ADD COLUMN IF NOT EXISTS season TEXT DEFAULT '2026';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS season TEXT DEFAULT '2026';

-- Create indexes for faster season-based queries
CREATE INDEX IF NOT EXISTS idx_children_season ON children(season);
CREATE INDEX IF NOT EXISTS idx_trips_season ON trips(season);
CREATE INDEX IF NOT EXISTS idx_sports_calendar_season ON sports_calendar(season);
CREATE INDEX IF NOT EXISTS idx_activities_field_trips_season ON activities_field_trips(season);
CREATE INDEX IF NOT EXISTS idx_special_events_activities_season ON special_events_activities(season);
CREATE INDEX IF NOT EXISTS idx_master_calendar_season ON master_calendar(season);
CREATE INDEX IF NOT EXISTS idx_daily_notes_season ON daily_notes(season);
CREATE INDEX IF NOT EXISTS idx_medication_logs_season ON medication_logs(season);
CREATE INDEX IF NOT EXISTS idx_awards_season ON awards(season);
CREATE INDEX IF NOT EXISTS idx_incident_reports_season ON incident_reports(season);
CREATE INDEX IF NOT EXISTS idx_staff_evaluations_season ON staff_evaluations(season);
CREATE INDEX IF NOT EXISTS idx_sports_academy_season ON sports_academy(season);
CREATE INDEX IF NOT EXISTS idx_menu_items_season ON menu_items(season);
CREATE INDEX IF NOT EXISTS idx_special_meals_season ON special_meals(season);
CREATE INDEX IF NOT EXISTS idx_rainy_day_schedule_season ON rainy_day_schedule(season);
CREATE INDEX IF NOT EXISTS idx_staff_season ON staff(season);

-- Add meal options columns to sports_calendar and activities_field_trips
ALTER TABLE sports_calendar ADD COLUMN IF NOT EXISTS meal_options TEXT[];
ALTER TABLE sports_calendar ADD COLUMN IF NOT EXISTS meal_notes TEXT;
ALTER TABLE activities_field_trips ADD COLUMN IF NOT EXISTS meal_options TEXT[];
ALTER TABLE activities_field_trips ADD COLUMN IF NOT EXISTS meal_notes TEXT;

-- Add late notes fields to medication_logs for nurse dashboard
ALTER TABLE medication_logs ADD COLUMN IF NOT EXISTS late_notes TEXT;
ALTER TABLE medication_logs ADD COLUMN IF NOT EXISTS late_notes_timestamp TIMESTAMPTZ;

-- Extend app_role enum with new roles
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'division_leader') THEN
    ALTER TYPE app_role ADD VALUE 'division_leader';
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid = e.enumtypid WHERE t.typname = 'app_role' AND e.enumlabel = 'specialist') THEN
    ALTER TYPE app_role ADD VALUE 'specialist';
  END IF;
END $$;