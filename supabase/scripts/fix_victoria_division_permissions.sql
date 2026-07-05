-- Remove Victoria from all divisions EXCEPT the ones she actually leads.
-- If she is the "head_of_girls_side", she probably shouldn't be tagged as "division_leader"
-- for every single boys division.

-- 1. First, let's see what we are about to delete
SELECT p.email, d.name AS division_name
FROM division_permissions dp
JOIN profiles p ON p.id = dp.user_id
JOIN divisions d ON d.id = dp.division_id
JOIN companies c ON c.id = p.company_id
WHERE c.slug = 'tyler-hill-camp'
  AND p.email = 'victoria@tylerhillcamp.com'
  AND d.gender = 'Boys';

-- 2. Delete her access to BOYS divisions (assuming she's head of girls side based on her tags)
DELETE FROM division_permissions dp
USING profiles p, divisions d, companies c
WHERE dp.user_id = p.id
  AND dp.division_id = d.id
  AND p.company_id = c.id
  AND c.slug = 'tyler-hill-camp'
  AND p.email = 'victoria@tylerhillcamp.com'
  AND d.gender = 'Boys';

-- NOTE: If she shouldn't get missed med emails AT ALL (e.g. she's a director, not a division leader),
-- the better fix is to remove her division_leader tag entirely:
-- DELETE FROM user_tags ut
-- USING profiles p, companies c
-- WHERE ut.user_id = p.id AND ut.company_id = c.id
--   AND c.slug = 'tyler-hill-camp'
--   AND p.email = 'victoria@tylerhillcamp.com'
--   AND ut.tag = 'division_leader';
