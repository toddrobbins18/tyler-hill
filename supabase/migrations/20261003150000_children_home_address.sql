-- Store camper household address from CampMinder sync (used by Transport unplotted list).

ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS home_address text;

COMMENT ON COLUMN public.children.home_address IS
  'Formatted household mailing address from CampMinder (family or person contact details). Used by day-camp Transport.';
