-- Fix search_path for all functions to address security warnings
DROP FUNCTION IF EXISTS public.handle_updated_at() CASCADE;
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$;

DROP FUNCTION IF EXISTS public.assign_default_role() CASCADE;
CREATE OR REPLACE FUNCTION public.assign_default_role()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'viewer');
  RETURN NEW;
END;
$function$;

-- Recreate all triggers
CREATE TRIGGER update_children_updated_at
BEFORE UPDATE ON public.children
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_profiles_updated_at
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_staff_updated_at
BEFORE UPDATE ON public.staff
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_evaluation_questions_updated_at
BEFORE UPDATE ON public.evaluation_questions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER update_medication_logs_updated_at
BEFORE UPDATE ON public.medication_logs
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_auth_user_created_assign_role
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.assign_default_role();