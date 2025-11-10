-- Add evaluation_round to staff_evaluations table
ALTER TABLE public.staff_evaluations
ADD COLUMN evaluation_round integer DEFAULT 1 CHECK (evaluation_round >= 1 AND evaluation_round <= 3);

COMMENT ON COLUMN public.staff_evaluations.evaluation_round IS 'Evaluation round number (1, 2, or 3)';

-- Add birthday preferences to children table
ALTER TABLE public.children
ADD COLUMN birthday_party_type text CHECK (birthday_party_type IN ('pizza', 'campfire', 'movie', 'ice_cream_sundae')),
ADD COLUMN birthday_cake_meal text CHECK (birthday_cake_meal IN ('lunch', 'dinner'));

COMMENT ON COLUMN public.children.birthday_party_type IS 'Type of birthday party preference: pizza, campfire, movie, or ice_cream_sundae';
COMMENT ON COLUMN public.children.birthday_cake_meal IS 'Preferred meal for birthday cake: lunch or dinner';