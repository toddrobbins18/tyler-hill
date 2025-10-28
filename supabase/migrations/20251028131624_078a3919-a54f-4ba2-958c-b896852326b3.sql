-- Update all children records with NULL season to 2025
UPDATE children
SET season = '2025'
WHERE season IS NULL;