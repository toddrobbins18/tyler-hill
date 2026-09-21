SELECT polname, polcmd, polpermissive, pg_get_expr(polqual, polrelid) AS using_expr, pg_get_expr(polwithcheck, polrelid) AS with_check
FROM pg_policy
WHERE polrelid = 'public.swim_lessons'::regclass
ORDER BY polname;
