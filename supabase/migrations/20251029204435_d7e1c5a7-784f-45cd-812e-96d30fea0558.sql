-- Add foreign key constraint with CASCADE delete
-- This ensures when a sports event is deleted, its associated trip is also deleted
ALTER TABLE trips 
DROP CONSTRAINT IF EXISTS trips_sports_event_id_fkey;

ALTER TABLE trips 
ADD CONSTRAINT trips_sports_event_id_fkey 
FOREIGN KEY (sports_event_id) 
REFERENCES sports_calendar(id) 
ON DELETE CASCADE;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_trips_sports_event_id ON trips(sports_event_id);