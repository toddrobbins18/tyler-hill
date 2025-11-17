-- Add delivery_methods tracking to email_logs
ALTER TABLE email_logs 
ADD COLUMN delivery_methods jsonb DEFAULT '["in_app"]'::jsonb;

COMMENT ON COLUMN email_logs.delivery_methods IS 
'Array of delivery methods used: in_app, email, or both';

-- Add notification_type column to messages table
ALTER TABLE messages 
ADD COLUMN notification_type text DEFAULT 'message';

COMMENT ON COLUMN messages.notification_type IS 
'Type of notification: message, notification, alert, system, etc.';