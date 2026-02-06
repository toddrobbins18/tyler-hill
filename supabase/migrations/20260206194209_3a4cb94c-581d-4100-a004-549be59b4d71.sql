
-- Fix infinite recursion in message_group_members policies
-- The SELECT policy references itself causing infinite recursion

-- Drop the recursive policies
DROP POLICY IF EXISTS "Members can view group membership" ON public.message_group_members;
DROP POLICY IF EXISTS "Group creator can add members" ON public.message_group_members;
DROP POLICY IF EXISTS "Group creator or self can remove members" ON public.message_group_members;

-- Also fix the group_messages SELECT policy which has the same issue
DROP POLICY IF EXISTS "Members can view group messages" ON public.group_messages;
DROP POLICY IF EXISTS "Members can post to their groups" ON public.group_messages;

-- Recreate message_group_members SELECT policy without self-reference
-- Use a direct check: user can see rows where they are a member of the same group
CREATE POLICY "Members can view group membership"
ON public.message_group_members FOR SELECT
USING (
  -- User can see their own membership rows
  user_id = auth.uid()
  -- Or user can see other members if they share a group (check via message_groups ownership)
  OR EXISTS (
    SELECT 1 FROM public.message_groups mg
    WHERE mg.id = message_group_members.group_id
    AND mg.created_by = auth.uid()
  )
  -- Or user is in the same group (use a security definer function to avoid recursion)
  OR group_id IN (
    SELECT mgm.group_id FROM public.message_group_members mgm WHERE mgm.user_id = auth.uid()
  )
);

-- Actually the above still has recursion. Let's use a security definer function instead.
DROP POLICY IF EXISTS "Members can view group membership" ON public.message_group_members;

-- Create a security definer function to check group membership without triggering RLS
CREATE OR REPLACE FUNCTION public.get_user_group_ids(_user_id uuid)
RETURNS uuid[]
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(ARRAY_AGG(group_id), ARRAY[]::uuid[])
  FROM public.message_group_members
  WHERE user_id = _user_id
$$;

-- Now create non-recursive policies using the helper function
CREATE POLICY "Members can view group membership"
ON public.message_group_members FOR SELECT
USING (
  group_id = ANY(public.get_user_group_ids(auth.uid()))
);

CREATE POLICY "Group creator can add members"
ON public.message_group_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.message_groups
    WHERE message_groups.id = message_group_members.group_id
    AND message_groups.created_by = auth.uid()
  )
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

-- Fix group_messages policies to use the helper function too
CREATE POLICY "Members can view group messages"
ON public.group_messages FOR SELECT
USING (
  group_id = ANY(public.get_user_group_ids(auth.uid()))
);

CREATE POLICY "Members can post to their groups"
ON public.group_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid()
  AND group_id = ANY(public.get_user_group_ids(auth.uid()))
);
