-- Migrate all children from season 2025 to 2026
UPDATE children 
SET season = '2026' 
WHERE season = '2025';

-- Migrate all health center admissions from season 2025 to 2026
UPDATE health_center_admissions 
SET season = '2026' 
WHERE season = '2025';