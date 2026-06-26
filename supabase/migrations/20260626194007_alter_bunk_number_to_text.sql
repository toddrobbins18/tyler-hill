-- Change bunk_number from INTEGER to TEXT to allow alphanumeric bunks (e.g. "B1", "G1")
ALTER TABLE public.bunks ALTER COLUMN bunk_number TYPE TEXT USING bunk_number::TEXT;