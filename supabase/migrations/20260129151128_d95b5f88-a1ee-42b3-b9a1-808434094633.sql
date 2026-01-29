-- Add fields for late sign-in override on staff_days_off table
ALTER TABLE public.staff_days_off
ADD COLUMN IF NOT EXISTS late_override BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS late_override_reason TEXT,
ADD COLUMN IF NOT EXISTS late_override_approved_by UUID REFERENCES auth.users(id),
ADD COLUMN IF NOT EXISTS late_override_approved_at TIMESTAMP WITH TIME ZONE;

-- Add guardian_name_p2 field to children table for P2 name
ALTER TABLE public.children
ADD COLUMN IF NOT EXISTS guardian_name_p2 TEXT;

-- Add file attachment fields to special_events_activities table
ALTER TABLE public.special_events_activities
ADD COLUMN IF NOT EXISTS file_url TEXT,
ADD COLUMN IF NOT EXISTS file_name TEXT;

-- Add Weekly Camper Award field to awards table
-- The category field already exists for storing award metadata, no change needed

-- Add gender field to staff table if not exists
ALTER TABLE public.staff
ADD COLUMN IF NOT EXISTS gender TEXT;