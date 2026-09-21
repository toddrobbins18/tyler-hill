-- Find test family swim lessons
SELECT sl.id, sl.parent_confirmed, sl.transport_status, c.name, f.family_name, f.user_id
FROM swim_lessons sl
JOIN children c ON c.id = sl.camper_id
JOIN family_children fc ON fc.child_id = c.id
JOIN families f ON f.id = fc.family_id
WHERE f.family_name ILIKE '%test%'
ORDER BY sl.scheduled_at DESC
LIMIT 5;
