-- Special meal menu items can optionally tag divisions (metadata only; not used for portal filtering).
ALTER TABLE public.menu_items
  ADD COLUMN IF NOT EXISTS division_ids uuid[] DEFAULT NULL;

COMMENT ON COLUMN public.menu_items.division_ids IS
  'Optional division tags when meal_type is special_meal. Display/metadata only — not used to filter menu visibility.';
