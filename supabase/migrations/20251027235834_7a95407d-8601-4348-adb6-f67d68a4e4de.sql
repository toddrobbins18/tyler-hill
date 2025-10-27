-- Add DELETE policy for profiles table to allow admins to delete user profiles
CREATE POLICY "Admins can delete profiles"
ON public.profiles 
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM public.user_roles
    WHERE user_id = auth.uid() 
      AND role = 'admin'::app_role
  )
);