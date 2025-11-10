-- Add new birthday party preference columns to children table
ALTER TABLE children 
ADD COLUMN IF NOT EXISTS birthday_party_comments text,
ADD COLUMN IF NOT EXISTS birthday_group text,
ADD COLUMN IF NOT EXISTS birthday_cake_type text,
ADD COLUMN IF NOT EXISTS birthday_frosting_colors text[],
ADD COLUMN IF NOT EXISTS birthday_toppings text[],
ADD COLUMN IF NOT EXISTS birthday_cake_allergies text[],
ADD COLUMN IF NOT EXISTS birthday_cake_message text;