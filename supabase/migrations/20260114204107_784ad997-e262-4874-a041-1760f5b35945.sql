-- Add RFID column to staff table for wristband scanning
ALTER TABLE staff ADD COLUMN rfid TEXT;

-- Create index for fast RFID lookups
CREATE INDEX idx_staff_rfid ON staff(rfid) WHERE rfid IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN staff.rfid IS 'RFID wristband identifier for quick check-in across the portal';