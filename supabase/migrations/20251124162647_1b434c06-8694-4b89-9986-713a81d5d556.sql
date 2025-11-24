-- Add send_timing field to automated_email_config table
ALTER TABLE automated_email_config 
ADD COLUMN send_timing text[] DEFAULT ARRAY['on_create'];

-- Create scheduled_notifications table for queued time-based notifications
CREATE TABLE scheduled_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  email_type text NOT NULL,
  event_id uuid,
  event_date date NOT NULL,
  event_time text,
  send_at timestamptz NOT NULL,
  timing_type text NOT NULL,
  sent boolean DEFAULT false,
  sent_at timestamptz,
  recipient_count integer,
  created_at timestamptz DEFAULT now(),
  error_message text,
  event_data jsonb
);

-- Create index for efficient querying of pending notifications
CREATE INDEX idx_scheduled_notifications_pending 
ON scheduled_notifications(sent, send_at) 
WHERE sent = false;

-- Create index for company filtering
CREATE INDEX idx_scheduled_notifications_company 
ON scheduled_notifications(company_id);

-- Enable RLS
ALTER TABLE scheduled_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Admins can view scheduled notifications for their company"
ON scheduled_notifications
FOR SELECT
USING (
  company_id = get_user_company(auth.uid()) 
  AND has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "System can insert scheduled notifications"
ON scheduled_notifications
FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update scheduled notifications"
ON scheduled_notifications
FOR UPDATE
USING (true);