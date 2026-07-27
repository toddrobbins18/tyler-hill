-- Repoint campers stuck on inactive division alias rows (Teen TN1 / Super Senior / etc.)
-- to canonical active divisions — ALL Nest camps (Tyler Hill, Timber Lake, Timber Lake West).
-- Safe to re-run.

DO $$
DECLARE
  bucket RECORD;
  canonical_id uuid;
BEGIN
  FOR bucket IN
    SELECT d.company_id, public.normalize_division_name_for_filter(d.name) AS norm
    FROM public.divisions d
    JOIN public.companies c ON c.id = d.company_id
    WHERE c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
      AND c.is_active = true
      AND public.normalize_division_name_for_filter(d.name) IN (
        'teen boys', 'teen girls', 'super boys', 'super girls'
      )
    GROUP BY d.company_id, public.normalize_division_name_for_filter(d.name)
  LOOP
    SELECT d.id
    INTO canonical_id
    FROM public.divisions d
    WHERE d.company_id = bucket.company_id
      AND d.is_active = true
      AND public.normalize_division_name_for_filter(d.name) = bucket.norm
    ORDER BY
      CASE d.name
        WHEN 'Teen Boys' THEN 1
        WHEN 'Teen Girls' THEN 1
        WHEN 'Super Boys' THEN 1
        WHEN 'Super Girls' THEN 1
        ELSE 2
      END,
      CASE WHEN d.name ~* 'Senior|TN\d+|Sub\s+Senior' THEN 2 ELSE 1 END,
      d.sort_order,
      d.created_at
    LIMIT 1;

    IF canonical_id IS NULL THEN
      CONTINUE;
    END IF;

    UPDATE public.children c
    SET division_id = canonical_id
    FROM public.divisions d
    WHERE c.division_id = d.id
      AND d.company_id = bucket.company_id
      AND public.normalize_division_name_for_filter(d.name) = bucket.norm
      AND c.division_id IS DISTINCT FROM canonical_id;
  END LOOP;
END $$;

-- Verify per camp: alias rows should have 0 campers; canonical rows hold the counts.
SELECT
  c.name AS camp,
  d.name AS division,
  public.normalize_division_name_for_filter(d.name) AS bucket,
  d.is_active,
  COUNT(ch.id) FILTER (WHERE ch.season = '2026' AND ch.status = 'active') AS active_campers_2026
FROM public.companies c
JOIN public.divisions d ON d.company_id = c.id
LEFT JOIN public.children ch ON ch.division_id = d.id AND ch.company_id = c.id
WHERE c.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
  AND public.normalize_division_name_for_filter(d.name) IN (
    'teen boys', 'teen girls', 'super boys', 'super girls'
  )
GROUP BY c.name, c.slug, d.name, public.normalize_division_name_for_filter(d.name), d.is_active, d.sort_order
ORDER BY c.name, public.normalize_division_name_for_filter(d.name), d.is_active DESC, d.sort_order;

-- Medication report sanity check (PRN-style rows per camp)
SELECT
  co.name AS camp,
  public.normalize_division_name_for_filter(d.name) AS bucket,
  COUNT(DISTINCT ch.id) AS campers,
  COUNT(ml.id) AS med_log_rows
FROM public.medication_logs ml
JOIN public.children ch ON ch.id = ml.child_id
JOIN public.divisions d ON d.id = ch.division_id
JOIN public.companies co ON co.id = ml.company_id
WHERE co.slug IN ('tyler-hill-camp', 'timber-lake-camp', 'timber-lake-west')
  AND ml.season = '2026'
  AND ch.status = 'active'
  AND public.normalize_division_name_for_filter(d.name) IN (
    'teen boys', 'teen girls', 'super boys', 'super girls'
  )
GROUP BY co.name, public.normalize_division_name_for_filter(d.name)
ORDER BY co.name, public.normalize_division_name_for_filter(d.name);
