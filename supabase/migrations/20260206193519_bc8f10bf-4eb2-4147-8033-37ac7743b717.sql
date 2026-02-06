
-- =============================================
-- GROUP MESSAGING & REPLY THREADS
-- =============================================

-- 1. Add parent_message_id for reply threads on individual messages
ALTER TABLE public.messages ADD COLUMN IF NOT EXISTS parent_message_id uuid REFERENCES public.messages(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_messages_parent_message_id ON public.messages(parent_message_id);

-- 2. Message Groups table
CREATE TABLE public.message_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.message_groups ENABLE ROW LEVEL SECURITY;

-- 3. Message Group Members table
CREATE TABLE public.message_group_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.message_groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(group_id, user_id)
);

ALTER TABLE public.message_group_members ENABLE ROW LEVEL SECURITY;

-- 4. Group Messages table
CREATE TABLE public.group_messages (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  group_id uuid NOT NULL REFERENCES public.message_groups(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id),
  content text NOT NULL,
  parent_message_id uuid REFERENCES public.group_messages(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_group_messages_group_id ON public.group_messages(group_id);
CREATE INDEX idx_group_messages_parent ON public.group_messages(parent_message_id);
CREATE INDEX idx_group_members_user_id ON public.message_group_members(user_id);
CREATE INDEX idx_group_members_group_id ON public.message_group_members(group_id);

-- =============================================
-- RLS POLICIES
-- =============================================

-- message_groups: members can view their groups
CREATE POLICY "Users can view groups they belong to"
ON public.message_groups FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.message_group_members
    WHERE message_group_members.group_id = message_groups.id
    AND message_group_members.user_id = auth.uid()
  )
  OR created_by = auth.uid()
);

CREATE POLICY "Authenticated users can create groups"
ON public.message_groups FOR INSERT
WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group creator can update group"
ON public.message_groups FOR UPDATE
USING (created_by = auth.uid());

CREATE POLICY "Group creator can delete group"
ON public.message_groups FOR DELETE
USING (created_by = auth.uid());

-- message_group_members
CREATE POLICY "Members can view group membership"
ON public.message_group_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.message_group_members AS mgm
    WHERE mgm.group_id = message_group_members.group_id
    AND mgm.user_id = auth.uid()
  )
);

CREATE POLICY "Group creator can add members"
ON public.message_group_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.message_groups
    WHERE message_groups.id = message_group_members.group_id
    AND message_groups.created_by = auth.uid()
  )
  OR user_id = auth.uid()
);

CREATE POLICY "Group creator or self can remove members"
ON public.message_group_members FOR DELETE
USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.message_groups
    WHERE message_groups.id = message_group_members.group_id
    AND message_groups.created_by = auth.uid()
  )
);

-- group_messages
CREATE POLICY "Members can view group messages"
ON public.group_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.message_group_members
    WHERE message_group_members.group_id = group_messages.group_id
    AND message_group_members.user_id = auth.uid()
  )
);

CREATE POLICY "Members can post to their groups"
ON public.group_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.message_group_members
    WHERE message_group_members.group_id = group_messages.group_id
    AND message_group_members.user_id = auth.uid()
  )
);

-- Enable realtime for group messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.group_messages;

-- Update trigger for message_groups
CREATE TRIGGER update_message_groups_updated_at
BEFORE UPDATE ON public.message_groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
