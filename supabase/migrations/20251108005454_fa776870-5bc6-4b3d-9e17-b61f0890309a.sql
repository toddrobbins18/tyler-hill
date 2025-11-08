-- Add Daily Operations columns to daily_wolf_content table
ALTER TABLE daily_wolf_content 
ADD COLUMN officer_of_day TEXT,
ADD COLUMN laundry_info TEXT,
ADD COLUMN phone_calls_info TEXT;