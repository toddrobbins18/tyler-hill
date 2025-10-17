-- Rename daily_schedule to special_events_activities
ALTER TABLE daily_schedule RENAME TO special_events_activities;

-- Add home_away column to sports_calendar for home/away game tracking
ALTER TABLE sports_calendar
ADD COLUMN home_away TEXT CHECK (home_away IN ('home', 'away'));

-- Modify sports_academy table: remove skill_level and schedule_days, add schedule_periods
ALTER TABLE sports_academy
DROP COLUMN IF EXISTS skill_level,
DROP COLUMN IF EXISTS schedule_days,
ADD COLUMN schedule_periods TEXT[] DEFAULT '{}';