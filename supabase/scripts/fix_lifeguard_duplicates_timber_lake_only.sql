BEGIN;

DELETE FROM public.staff_leader_assignments sla
USING public.staff s
WHERE sla.staff_id = s.id
  AND s.season = '2026'
  AND s.company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND s.person_id IN (
    '19475197', '20720302', '20532253', '19236996', '20876585',
    '20684464', '19477743', '20696046', '20541630', '21218822',
    '20439490', '19368029', '18353012'
  );

DELETE FROM public.staff
WHERE season = '2026'
  AND company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'::uuid
  AND person_id IN (
    '19475197', '20720302', '20532253', '19236996', '20876585',
    '20684464', '19477743', '20696046', '20541630', '21218822',
    '20439490', '19368029', '18353012'
  );

COMMIT;
