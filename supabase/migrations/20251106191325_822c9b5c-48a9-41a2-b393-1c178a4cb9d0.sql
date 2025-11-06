-- Add staff_type column to staff table
ALTER TABLE staff
ADD COLUMN staff_type TEXT CHECK (staff_type IN ('general_counselor', 'specialist', 'both'));

-- Add index for better query performance
CREATE INDEX idx_staff_staff_type ON staff(staff_type) WHERE staff_type IS NOT NULL;