-- Repoint Tyler Hill campers stuck on inactive Teen TN1 / Super Senior alias divisions
-- to the canonical active division rows (Teen Boys/Girls, Super Boys/Girls).
-- Safe to re-run.

DO $$
DECLARE
  bucket RECORD;
  canonical_id uuid;
BEGIN
  FOR bucket IN
    SELECT d.company_id, public.normalize_division_name_for_filter(d.name) AS norm
    FROM public.divisions d
    WHERE d.company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'
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

-- Verify
SELECT
  d.name AS division,
  public.normalize_division_name_for_filter(d.name) AS bucket,
  d.is_active,
  COUNT(c.id) AS active_campers
FROM public.divisions d
LEFT JOIN public.children c
  ON c.division_id = d.id
 AND c.company_id = d.company_id
 AND c.season = '2026'
 AND c.status = 'active'
WHERE d.company_id = '0d0b7f4f-327e-4497-83ff-3aa501ffc295'
  AND public.normalize_division_name_for_filter(d.name) IN (
    'teen boys', 'teen girls', 'super boys', 'super girls'
  )
GROUP BY d.id, d.name, d.is_active, bucket
ORDER BY bucket, d.is_active DESC, d.name;
