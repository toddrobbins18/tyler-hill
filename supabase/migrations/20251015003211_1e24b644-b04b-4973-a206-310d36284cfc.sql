-- Approve all existing users (they were already in the system)
UPDATE public.profiles 
SET approved = true 
WHERE approval_requested_at IS NOT NULL OR created_at < NOW();

-- Also approve any admin users specifically
UPDATE public.profiles
SET approved = true
WHERE id IN (
  SELECT user_id 
  FROM public.user_roles 
  WHERE role = 'admin'
);