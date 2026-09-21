-- Simulate parent confirm (old client payload with transport_status)
UPDATE swim_lessons
SET parent_confirmed = true,
    parent_confirmed_at = now(),
    transport_status = 'submitted'
WHERE id = '6ee4ec0d-04fa-4405-9f82-16058a5c7b1d';

SELECT id, parent_confirmed, transport_status, parent_confirmed_at
FROM swim_lessons
WHERE id = '6ee4ec0d-04fa-4405-9f82-16058a5c7b1d';

-- Reset for parent testing
UPDATE swim_lessons
SET parent_confirmed = false,
    parent_confirmed_at = null,
    transport_status = null
WHERE id = '6ee4ec0d-04fa-4405-9f82-16058a5c7b1d';

-- Simulate new client payload (parent_confirmed only, trigger sets transport_status)
UPDATE swim_lessons
SET parent_confirmed = true,
    parent_confirmed_at = now()
WHERE id = '6ee4ec0d-04fa-4405-9f82-16058a5c7b1d';

SELECT id, parent_confirmed, transport_status, parent_confirmed_at
FROM swim_lessons
WHERE id = '6ee4ec0d-04fa-4405-9f82-16058a5c7b1d';
