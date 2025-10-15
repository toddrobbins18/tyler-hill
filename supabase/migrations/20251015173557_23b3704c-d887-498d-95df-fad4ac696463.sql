-- Add new fields to trips table for enhanced transportation details
ALTER TABLE public.trips 
ADD COLUMN meal TEXT,
ADD COLUMN event_type TEXT,
ADD COLUMN event_length TEXT,
ADD COLUMN transportation_type TEXT,
ADD COLUMN driver TEXT;