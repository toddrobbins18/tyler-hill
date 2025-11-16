-- Add max_rating column to camper_evaluation_questions
ALTER TABLE camper_evaluation_questions 
ADD COLUMN max_rating integer;

-- Set default to 10 for existing rating questions
UPDATE camper_evaluation_questions 
SET max_rating = 10 
WHERE question_type = 'rating';

-- Update End of Summer 3-point scale questions (questions 5-14)
UPDATE camper_evaluation_questions 
SET max_rating = 3 
WHERE report_type = 'end_of_summer' 
  AND question_type = 'rating'
  AND sort_order BETWEEN 5 AND 14;