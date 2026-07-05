-- Remove Victoria from receiving automated emails by removing her division_leader tag
-- and any other tags that might trigger emails (like admin, director, nurse, etc.)

DELETE FROM user_tags ut
USING profiles p, companies c
WHERE ut.user_id = p.id 
  AND ut.company_id = c.id
  AND c.slug = 'tyler-hill-camp'
  AND p.email = 'victoria@tylerhillcamp.com';

-- Verify her tags are gone
SELECT p.email, ut.tag
FROM profiles p
JOIN companies c ON c.id = p.company_id
LEFT JOIN user_tags ut ON ut.user_id = p.id AND ut.company_id = c.id
WHERE c.slug = 'tyler-hill-camp'
  AND p.email = 'victoria@tylerhillcamp.com';
