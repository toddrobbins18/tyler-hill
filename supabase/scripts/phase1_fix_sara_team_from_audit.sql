-- PHASE 1: Fix Sara's team (Todd confirmed inactive should be active)
-- Tyler Hill: 0d0b7f4f-327e-4497-83ff-3aa501ffc295
-- Sara staff_id: e12b8a60-d23e-4ced-a72b-e7deee271af0
--
-- Run in Supabase SQL Editor (production).

BEGIN;

-- 1) Activate the 10 inactive staff on Todd's list
UPDATE public.staff
SET status = 'active', updated_at = now()
WHERE season = '2026'
  AND company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND name IN (
    'Evelyn Cant', 'Megan Hollinger', 'Harvey Jager', 'Freddie Kinder',
    'Amelie Lovelock', 'Jack Mooney', 'Jack Pool', 'William Shaw',
    'Evie Wildish', 'Hannah Wiles'
  )
  AND LOWER(COALESCE(status, '')) = 'inactive';

-- 2) Add missing staff_leader_assignments
INSERT INTO public.staff_leader_assignments (staff_id, leader_id, company_id, season)
SELECT s.id, 'e12b8a60-d23e-4ced-a72b-e7deee271af0'::uuid,
       '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid, '2026'
FROM public.staff s
WHERE s.season = '2026'
  AND s.company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND s.name IN ('Jack Mooney', 'Alex Smith', 'Steven Fina')
ON CONFLICT DO NOTHING;

-- 3) Set leader_id for Steven Fina (was missing)
UPDATE public.staff
SET leader_id = 'e12b8a60-d23e-4ced-a72b-e7deee271af0'::uuid, updated_at = now()
WHERE season = '2026'
  AND company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND name = 'Steven Fina'
  AND leader_id IS DISTINCT FROM 'e12b8a60-d23e-4ced-a72b-e7deee271af0'::uuid;

-- 4) Remove extras not on Todd's list from Sara's direct reports
UPDATE public.staff
SET leader_id = NULL, updated_at = now()
WHERE season = '2026'
  AND company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND leader_id = 'e12b8a60-d23e-4ced-a72b-e7deee271af0'::uuid
  AND name IN ('Jessica Ingram', 'Lucy Morris');

COMMIT;

-- Verify: all 19 should be active + OK
SELECT name, role, status,
  leader_id = 'e12b8a60-d23e-4ced-a72b-e7deee271af0'::uuid AS leader_is_sara
FROM public.staff
WHERE season = '2026'
  AND company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND name IN (
    'Aidan Casey', 'Amelie Lovelock', 'Callum Skelly', 'Cooper Flaum',
    'Evelyn Cant', 'Evie Wildish', 'Freddie Kinder', 'Hannah Wiles',
    'Harvey Jager', 'Holly Makin', 'Jack Pool', 'Luke Holland',
    'Megan Hollinger', 'Miriam Aparicio', 'Poppy Hogg', 'Steven Fina',
    'William Shaw', 'Jack Mooney', 'Alex Smith'
  )
ORDER BY name;
