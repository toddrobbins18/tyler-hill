
-- Delete duplicate children records, keeping only the first occurrence per person_id
DELETE FROM children
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (PARTITION BY person_id ORDER BY created_at ASC, id ASC) as rn
    FROM children
    WHERE person_id IS NOT NULL
  ) t
  WHERE t.rn > 1
);
