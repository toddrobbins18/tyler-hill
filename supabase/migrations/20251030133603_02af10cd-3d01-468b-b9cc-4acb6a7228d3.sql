-- Migrate all children from season 2026 to 2025
UPDATE children 
SET season = '2025' 
WHERE season = '2026';

-- Migrate all health center admissions from season 2026 to 2025
UPDATE health_center_admissions 
SET season = '2025' 
WHERE season = '2026';

-- Migrate medication logs from season 2026 to 2025
UPDATE medication_logs 
SET season = '2025' 
WHERE season = '2026';

-- Migrate daily notes from season 2026 to 2025
UPDATE daily_notes 
SET season = '2025' 
WHERE season = '2026';

-- Migrate awards from season 2026 to 2025
UPDATE awards 
SET season = '2025' 
WHERE season = '2026';

-- Migrate incident reports from season 2026 to 2025
UPDATE incident_reports 
SET season = '2025' 
WHERE season = '2026';

-- Migrate sports academy from season 2026 to 2025
UPDATE sports_academy 
SET season = '2025' 
WHERE season = '2026';

-- Migrate tutoring therapy from season 2026 to 2025
UPDATE tutoring_therapy 
SET season = '2025' 
WHERE season = '2026';

-- Migrate menu items from season 2026 to 2025
UPDATE menu_items 
SET season = '2025' 
WHERE season = '2026';

-- Migrate special meals from season 2026 to 2025
UPDATE special_meals 
SET season = '2025' 
WHERE season = '2026';

-- Migrate rainy day schedule from season 2026 to 2025
UPDATE rainy_day_schedule 
SET season = '2025' 
WHERE season = '2026';

-- Migrate trips from season 2026 to 2025
UPDATE trips 
SET season = '2025' 
WHERE season = '2026';

-- Migrate sports calendar from season 2026 to 2025
UPDATE sports_calendar 
SET season = '2025' 
WHERE season = '2026';

-- Migrate activities field trips from season 2026 to 2025
UPDATE activities_field_trips 
SET season = '2025' 
WHERE season = '2026';

-- Migrate special events activities from season 2026 to 2025
UPDATE special_events_activities 
SET season = '2025' 
WHERE season = '2026';

-- Migrate master calendar from season 2026 to 2025
UPDATE master_calendar 
SET season = '2025' 
WHERE season = '2026';

-- Migrate staff from season 2026 to 2025
UPDATE staff 
SET season = '2025' 
WHERE season = '2026';

-- Migrate staff evaluations from season 2026 to 2025
UPDATE staff_evaluations 
SET season = '2025' 
WHERE season = '2026';