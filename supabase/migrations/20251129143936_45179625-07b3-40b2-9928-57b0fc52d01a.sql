-- First, update any existing null or empty person_id values with auto-generated IDs
UPDATE children 
SET person_id = CONCAT('AUTO-', id) 
WHERE person_id IS NULL OR person_id = '';

-- Then alter the column to be NOT NULL
ALTER TABLE children 
ALTER COLUMN person_id SET NOT NULL;