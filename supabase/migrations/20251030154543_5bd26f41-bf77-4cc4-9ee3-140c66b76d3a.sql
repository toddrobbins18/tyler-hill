-- Create tag type enum
CREATE TYPE public.tag_type AS ENUM (
  'nurse',
  'transportation',
  'food_service',
  'specialist',
  'division_leader',
  'director',
  'general_staff',
  'admin_staff'
);

-- Create user tags table (many-to-many relationship)
CREATE TABLE public.user_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tag public.tag_type NOT NULL,
  created_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES auth.users(id),
  UNIQUE(user_id, tag)
);

-- Enable RLS
ALTER TABLE public.user_tags ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_tags
CREATE POLICY "Admins can manage user tags"
  ON public.user_tags
  FOR ALL
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view all tags"
  ON public.user_tags
  FOR SELECT
  TO authenticated
  USING (true);

-- Create email logs table
CREATE TABLE public.email_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sent_at timestamptz DEFAULT now(),
  sent_by uuid REFERENCES auth.users(id),
  subject text NOT NULL,
  recipient_count integer NOT NULL,
  recipient_tags text[],
  recipient_ids uuid[],
  status text CHECK (status IN ('sent', 'failed', 'partial')),
  error_details jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.email_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for email_logs
CREATE POLICY "Admins and staff can view email logs"
  ON public.email_logs
  FOR SELECT
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "System can insert email logs"
  ON public.email_logs
  FOR INSERT
  WITH CHECK (true);