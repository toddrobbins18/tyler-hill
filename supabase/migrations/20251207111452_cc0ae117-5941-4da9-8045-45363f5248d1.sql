-- Add departure time fields to activities_field_trips
ALTER TABLE activities_field_trips 
ADD COLUMN IF NOT EXISTS depart_from_camp text,
ADD COLUMN IF NOT EXISTS depart_from_activity text;

-- Add start/end time fields to special_events_activities
ALTER TABLE special_events_activities 
ADD COLUMN IF NOT EXISTS start_time text,
ADD COLUMN IF NOT EXISTS end_time text;

-- Add depart_time and start_time fields to sports_calendar
ALTER TABLE sports_calendar 
ADD COLUMN IF NOT EXISTS depart_time text,
ADD COLUMN IF NOT EXISTS start_time_field text;