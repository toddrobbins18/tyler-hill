-- 1. Fix children gender constraint (accept case variations from CampMinder)
ALTER TABLE children DROP CONSTRAINT IF EXISTS children_gender_check;
ALTER TABLE children ADD CONSTRAINT children_gender_check 
  CHECK (gender IS NULL OR gender IN ('Male', 'Female', 'male', 'female', 'Other', 'other'));

-- 2. Remove children session constraint (CampMinder uses custom session names like "Full Summer")
ALTER TABLE children DROP CONSTRAINT IF EXISTS children_session_check;

-- 3. Fix divisions gender constraint (allow Coed + case variations)
ALTER TABLE divisions DROP CONSTRAINT IF EXISTS divisions_gender_check;
ALTER TABLE divisions ADD CONSTRAINT divisions_gender_check 
  CHECK (gender IN ('Girls', 'Boys', 'Coed', 'Male', 'Female', 'male', 'female', 'coed'));

-- 4. Remove staff session constraint (same issue as children)
ALTER TABLE staff DROP CONSTRAINT IF EXISTS staff_session_check;