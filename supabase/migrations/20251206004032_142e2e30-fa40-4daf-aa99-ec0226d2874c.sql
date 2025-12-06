-- Add CampMinder API configuration columns to companies table
ALTER TABLE public.companies
ADD COLUMN IF NOT EXISTS campminder_api_key_encrypted text,
ADD COLUMN IF NOT EXISTS campminder_subscription_key_encrypted text,
ADD COLUMN IF NOT EXISTS campminder_sync_enabled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS campminder_last_sync_at timestamp with time zone;