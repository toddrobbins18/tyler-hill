-- Add group_id column to messages table so inbox notifications can link back to group chats
ALTER TABLE public.messages ADD COLUMN group_id UUID REFERENCES public.message_groups(id) ON DELETE SET NULL;

-- Index for efficient lookups
CREATE INDEX idx_messages_group_id ON public.messages(group_id) WHERE group_id IS NOT NULL;