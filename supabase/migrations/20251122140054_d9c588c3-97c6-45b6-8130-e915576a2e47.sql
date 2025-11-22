-- Clean up duplicate/deprecated email configuration records
-- Remove old email types that have been replaced

-- Delete sports_event_update (replaced by sports_event_home and sports_event_away)
DELETE FROM automated_email_config 
WHERE email_type = 'sports_event_update';

-- Delete transportation_event (singular, replaced by transportation_events plural)
DELETE FROM automated_email_config 
WHERE email_type = 'transportation_event';

-- Log the cleanup
DO $$
BEGIN
  RAISE NOTICE 'Cleaned up deprecated email configuration records';
END $$;