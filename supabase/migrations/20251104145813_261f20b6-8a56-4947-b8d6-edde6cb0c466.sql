-- Drop the unique constraint on name alone
ALTER TABLE divisions DROP CONSTRAINT IF EXISTS divisions_name_key;

-- Add a unique constraint on (company_id, name) to allow same names across different companies
ALTER TABLE divisions ADD CONSTRAINT divisions_company_name_unique UNIQUE (company_id, name);