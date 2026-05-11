-- Denormalized label for inbox/sent UI when profiles RLS or cross-camp resolution hides the sender row.
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS sender_display_name text;

COMMENT ON COLUMN public.messages.sender_display_name IS
  'Sender label at send time (full name or email local-part); used when sender_id resolution fails on clients.';
