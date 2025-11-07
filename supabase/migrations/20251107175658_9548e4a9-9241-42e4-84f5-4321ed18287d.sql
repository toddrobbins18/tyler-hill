-- Add session field to children and staff tables for Session 1 and Session 2 filtering
ALTER TABLE children ADD COLUMN IF NOT EXISTS session text CHECK (session IN ('session_1', 'session_2', 'both'));
ALTER TABLE staff ADD COLUMN IF NOT EXISTS session text CHECK (session IN ('session_1', 'session_2', 'both'));

-- Set default value for existing records
UPDATE children SET session = 'both' WHERE session IS NULL;
UPDATE staff SET session = 'both' WHERE session IS NULL;