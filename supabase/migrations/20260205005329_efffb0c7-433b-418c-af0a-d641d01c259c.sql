-- Add specific_recipient_id column for email types that need a specific user (like toothfairy)
ALTER TABLE public.automated_email_config 
ADD COLUMN specific_recipient_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;