SELECT tgname FROM pg_trigger 
WHERE tgrelid = 'public.swim_lessons'::regclass AND NOT tgisinternal;
