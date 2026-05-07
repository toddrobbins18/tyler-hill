-- Non-admin staff could not read coworkers' profiles after profiles RLS tightened.
-- Messages / NotificationBell resolve sender names via profiles; rows were invisible → "System" label.
CREATE POLICY "Users can view coworker profiles in their company"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  company_id IS NOT NULL
  AND company_id = get_user_company(auth.uid())
);
