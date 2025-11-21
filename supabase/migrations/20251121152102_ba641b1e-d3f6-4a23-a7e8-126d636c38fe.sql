-- Add zip_code column to companies table
ALTER TABLE companies ADD COLUMN zip_code TEXT;

-- Populate zip codes for each camp
UPDATE companies SET zip_code = '12480' WHERE slug = 'timber-lake-camp';
UPDATE companies SET zip_code = '12776' WHERE slug = 'timber-lake-west';
UPDATE companies SET zip_code = '18469' WHERE slug = 'tyler-hill-camp';