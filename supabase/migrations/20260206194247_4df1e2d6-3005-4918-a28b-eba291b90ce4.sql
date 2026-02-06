
-- Fix the message_groups SELECT policy - it references message_group_members 
-- which causes infinite recursion when message_group_members INSERT policy checks message_groups

DROP POLICY IF EXISTS "Users can view groups they belong to" ON public.message_groups;

-- Use the security definer function instead of direct table reference
CREATE POLICY "Users can view groups they belong to"
ON public.message_groups FOR SELECT
USING (
  id = ANY(public.get_user_group_ids(auth.uid()))
  OR created_by = auth.uid()
);

-- Also fix the INSERT policy on message_group_members to use the function
DROP POLICY IF EXISTS "Group creator can add members" ON public.message_group_members;

CREATE OR REPLACE FUNCTION public.is_group_creator(_user_id uuid, _group_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.message_groups
    WHERE id = _group_id AND created_by = _user_id
  )
$$;

CREATE POLICY "Group creator can add members"
ON public.message_group_members FOR INSERT
WITH CHECK (
  public.is_group_creator(auth.uid(), group_id)
);

-- Fix DELETE policy too
DROP POLICY IF EXISTS "Group creator or self can remove members" ON public.message_group_members;

CREATE POLICY "Group creator or self can remove members"
ON public.message_group_members FOR DELETE
USING (
  user_id = auth.uid()
  OR public.is_group_creator(auth.uid(), group_id)
);
