-- Improve Realtime `postgres_changes` delivery for `public.messages` (filters + UPDATE/DELETE payloads).
ALTER TABLE IF EXISTS public.messages REPLICA IDENTITY FULL;
