-- Check if the RLS policies are actually applied
SELECT polname, polcmd, polqual, polwithcheck
FROM pg_policy
WHERE polrelid = 'public.incident_children'::regclass;
