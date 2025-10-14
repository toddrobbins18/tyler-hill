-- Add supervisor_id to staff_evaluations
ALTER TABLE staff_evaluations ADD COLUMN IF NOT EXISTS supervisor_id UUID REFERENCES staff(id);

-- Create evaluation_questions table for custom evaluation questions
CREATE TABLE IF NOT EXISTS evaluation_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  question_text TEXT NOT NULL,
  question_type TEXT NOT NULL CHECK (question_type IN ('multiple_choice', 'text', 'rating')),
  options TEXT[], -- For multiple choice questions
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create evaluation_responses table to store answers
CREATE TABLE IF NOT EXISTS evaluation_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id UUID REFERENCES staff_evaluations(id) ON DELETE CASCADE,
  question_id UUID REFERENCES evaluation_questions(id),
  response_text TEXT,
  response_value NUMERIC,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create medication_logs table for tracking children's daily medications
CREATE TABLE IF NOT EXISTS medication_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id UUID REFERENCES children(id) ON DELETE CASCADE,
  medication_name TEXT NOT NULL,
  dosage TEXT,
  scheduled_time TIME NOT NULL,
  date DATE NOT NULL,
  administered BOOLEAN DEFAULT false,
  administered_by UUID REFERENCES staff(id),
  administered_at TIMESTAMPTZ,
  notes TEXT,
  alert_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on new tables
ALTER TABLE evaluation_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluation_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE medication_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for evaluation_questions
CREATE POLICY "Admins and staff can view evaluation questions"
ON evaluation_questions FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Only admins can manage evaluation questions"
ON evaluation_questions FOR ALL
USING (has_role(auth.uid(), 'admin'));

-- RLS policies for evaluation_responses
CREATE POLICY "Admins and supervisors can view evaluation responses"
ON evaluation_responses FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admins and supervisors can manage evaluation responses"
ON evaluation_responses FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

-- RLS policies for medication_logs
CREATE POLICY "Admins and staff can view medication logs"
ON medication_logs FOR SELECT
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

CREATE POLICY "Admins and staff can manage medication logs"
ON medication_logs FOR ALL
USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'staff'));

-- Create triggers for updated_at
CREATE TRIGGER update_evaluation_questions_updated_at
BEFORE UPDATE ON evaluation_questions
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER update_medication_logs_updated_at
BEFORE UPDATE ON medication_logs
FOR EACH ROW
EXECUTE FUNCTION handle_updated_at();

-- Enable realtime for live dashboard updates
ALTER PUBLICATION supabase_realtime ADD TABLE evaluation_questions;
ALTER PUBLICATION supabase_realtime ADD TABLE evaluation_responses;
ALTER PUBLICATION supabase_realtime ADD TABLE medication_logs;
ALTER PUBLICATION supabase_realtime ADD TABLE staff_evaluations;
ALTER PUBLICATION supabase_realtime ADD TABLE children;
ALTER PUBLICATION supabase_realtime ADD TABLE awards;
ALTER PUBLICATION supabase_realtime ADD TABLE daily_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE trips;