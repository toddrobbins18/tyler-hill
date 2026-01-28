-- Add unique constraint on user_id and division_id for division_permissions upsert
ALTER TABLE public.division_permissions
ADD CONSTRAINT division_permissions_user_division_unique UNIQUE (user_id, division_id);