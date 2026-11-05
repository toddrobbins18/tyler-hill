-- Replies on a group or bus message. Visible to the same families who can see the post, and to staff.

CREATE TABLE IF NOT EXISTS public.parent_audience_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  announcement_id uuid NOT NULL REFERENCES public.parent_portal_announcements(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  sender_name text,
  body text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT parent_audience_replies_body_not_blank CHECK (length(trim(body)) > 0)
);

CREATE INDEX IF NOT EXISTS idx_parent_audience_replies_announcement
  ON public.parent_audience_replies (announcement_id, created_at);

GRANT SELECT, INSERT ON public.parent_audience_replies TO authenticated;
GRANT ALL ON public.parent_audience_replies TO service_role;

ALTER TABLE public.parent_audience_replies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Read audience message replies" ON public.parent_audience_replies;
CREATE POLICY "Read audience message replies"
  ON public.parent_audience_replies
  FOR SELECT
  TO authenticated
  USING (
    public.parent_can_read_announcement(announcement_id)
    OR EXISTS (
      SELECT 1
      FROM public.parent_portal_announcements a
      WHERE a.id = announcement_id
        AND a.company_id = public.get_user_company(auth.uid())
    )
  );

DROP POLICY IF EXISTS "Reply to an audience message" ON public.parent_audience_replies;
CREATE POLICY "Reply to an audience message"
  ON public.parent_audience_replies
  FOR INSERT
  TO authenticated
  WITH CHECK (
    sender_id = auth.uid()
    AND (
      public.parent_can_read_announcement(announcement_id)
      OR EXISTS (
        SELECT 1
        FROM public.parent_portal_announcements a
        WHERE a.id = announcement_id
          AND a.company_id = public.get_user_company(auth.uid())
      )
    )
  );
