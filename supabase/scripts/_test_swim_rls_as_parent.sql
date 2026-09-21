-- Test parent RLS for swim confirm
BEGIN;
SET LOCAL role TO authenticated;
SELECT set_config('request.jwt.claim.sub', '11a65a16-1acb-496d-a5d9-8623fea3922a', true);
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

-- Reset lesson first
UPDATE swim_lessons
SET parent_confirmed = false, parent_confirmed_at = null, transport_status = null
WHERE id = '6ee4ec0d-04fa-4405-9f82-16058a5c7b1d';

-- Old production payload
UPDATE swim_lessons
SET parent_confirmed = true,
    parent_confirmed_at = now(),
    transport_status = 'submitted'
WHERE id = '6ee4ec0d-04fa-4405-9f82-16058a5c7b1d';

SELECT id, parent_confirmed, transport_status
FROM swim_lessons
WHERE id = '6ee4ec0d-04fa-4405-9f82-16058a5c7b1d';

ROLLBACK;
