-- Backfill denormalized sender labels for existing rows (migration added the column only).
UPDATE public.messages AS m
SET sender_display_name = COALESCE(
  NULLIF(TRIM(p.full_name), ''),
  NULLIF(SPLIT_PART(p.email, '@', 1), ''),
  'Staff'
)
FROM public.profiles AS p
WHERE m.sender_id = p.id
  AND (m.sender_display_name IS NULL OR TRIM(m.sender_display_name) = '');
