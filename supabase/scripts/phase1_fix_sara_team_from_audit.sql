-- PHASE 1: Fix Sara's team based on audit results (2026-07-22)
-- Tyler Hill: 0d0b7f4f-327e-4497-83ff-3aa501ffc295
-- Sara staff_id: e12b8a60-d23e-4ced-a72b-e7deee271af0
--
-- Audit summary:
--   19/19 on Todd's list, all Tyler Hill
--   9 active, 10 inactive (hidden in app)
--   2 extras on Sara's team NOT on Todd's list: Jessica Ingram, Lucy Morris
--   Missing sla: Jack Mooney, Alex Smith, Steven Fina
--
-- RUN PREVIEWS FIRST. Uncomment one block at a time.

-- ── PREVIEW: inactive on Todd's list ────────────────────────────────────────

SELECT id, name, role, status
FROM public.staff
WHERE season = '2026'
  AND company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND name IN (
    'Evelyn Cant', 'Megan Hollinger', 'Harvey Jager', 'Freddie Kinder',
    'Amelie Lovelock', 'Jack Mooney', 'Jack Pool', 'William Shaw',
    'Evie Wildish', 'Hannah Wiles'
  )
ORDER BY name;

-- ── PREVIEW: extras assigned to Sara (not on Todd's list) ───────────────────

SELECT id, name, role, status, leader_id
FROM public.staff
WHERE season = '2026'
  AND company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND leader_id = 'e12b8a60-d23e-4ced-a72b-e7deee271af0'::uuid
  AND name NOT IN (
    'Sarah Pitre', 'Aidan Casey', 'Amelie Lovelock', 'Callum Skelly', 'Cooper Flaum',
    'Evelyn Cant', 'Evie Wildish', 'Freddie Kinder', 'Hannah Wiles', 'Harvey Jager',
    'Holly Makin', 'Jack Pool', 'Luke Holland', 'Megan Hollinger', 'Miriam Aparicio',
    'Poppy Hogg', 'Steven Fina', 'William Shaw', 'Jack Mooney', 'Alex Smith'
  );

-- ── 1) Activate Todd's inactive team (only if they are current 2026 staff) ──
/*
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
*/

-- ── 2) Add missing staff_leader_assignments ─────────────────────────────────

/*
INSERT INTO public.staff_leader_assignments (staff_id, leader_id, company_id, season)
SELECT s.id, 'e12b8a60-d23e-4ced-a72b-e7deee271af0'::uuid,
       '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid, '2026'
FROM public.staff s
WHERE s.season = '2026'
  AND s.company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND s.name IN ('Jack Mooney', 'Alex Smith', 'Steven Fina')
ON CONFLICT DO NOTHING;
*/

-- ── 3) Remove extras from Sara's direct reports (keep Todd's list only) ─────
-- Clears leader_id only; does not delete staff_leader_assignments rows for them.

/*
UPDATE public.staff
SET leader_id = NULL, updated_at = now()
WHERE season = '2026'
  AND company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND leader_id = 'e12b8a60-d23e-4ced-a72b-e7deee271af0'::uuid
  AND name IN ('Jessica Ingram', 'Lucy Morris');
*/

-- ── VERIFY after fixes ──────────────────────────────────────────────────────
-- Re-run: phase1_verify_sara_staff_access.sql sections B, C, D
