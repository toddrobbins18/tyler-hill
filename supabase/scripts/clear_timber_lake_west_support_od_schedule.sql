-- Clear fixed OD patterns for Male Support / Female Support bunks (Timber Lake West).
-- Support staff use flexible nightly off in the app instead of Jack's Mon/Tue/Wed schedule.
-- Safe to re-run.

DELETE FROM public.staff_days_off sdo
USING public.companies c,
  public.bunk_staff bs,
  public.bunks b
WHERE sdo.company_id = c.id
  AND c.slug = 'timber-lake-west'
  AND sdo.season = '2026'
  AND bs.staff_id = sdo.staff_id
  AND bs.company_id = c.id
  AND b.id = bs.bunk_id
  AND b.season = '2026'
  AND lower(trim(b.bunk_name)) IN ('male support', 'female support');

SELECT
  b.bunk_name,
  COUNT(DISTINCT bs.staff_id) AS support_staff,
  COUNT(sdo.id) AS remaining_schedule_rows
FROM public.companies c
JOIN public.bunks b ON b.company_id = c.id AND b.season = '2026'
JOIN public.bunk_staff bs ON bs.bunk_id = b.id
LEFT JOIN public.staff_days_off sdo
  ON sdo.staff_id = bs.staff_id
 AND sdo.company_id = c.id
 AND sdo.season = '2026'
WHERE c.slug = 'timber-lake-west'
  AND lower(trim(b.bunk_name)) IN ('male support', 'female support')
GROUP BY b.bunk_name
ORDER BY b.bunk_name;

-- Expected: remaining_schedule_rows = 0 until they sign out (creates that night's row).
