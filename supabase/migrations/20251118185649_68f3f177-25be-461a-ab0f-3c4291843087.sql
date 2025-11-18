-- Add RFID column to children table for bracelet scanning
ALTER TABLE children ADD COLUMN rfid TEXT;

-- Create index for fast RFID lookups during medication check-in
CREATE INDEX idx_children_rfid ON children(rfid) WHERE rfid IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN children.rfid IS 'RFID bracelet identifier for quick medication check-in at health center';