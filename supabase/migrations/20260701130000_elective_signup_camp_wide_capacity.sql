-- Camp-wide elective capacity: one slot (week + day + period + elective) shares capacity across all divisions.

CREATE OR REPLACE FUNCTION public.enforce_elective_signup_capacity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cap integer;
  existing_count integer;
BEGIN
  IF NEW.elective_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT e.capacity
  INTO cap
  FROM public.electives e
  WHERE e.id = NEW.elective_id;

  IF cap IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT count(*)
  INTO existing_count
  FROM public.elective_signups es
  WHERE es.company_id = NEW.company_id
    AND es.elective_id = NEW.elective_id
    AND es.week_start_date = NEW.week_start_date
    AND es.day_of_week = NEW.day_of_week
    AND es.period = NEW.period
    AND (TG_OP = 'INSERT' OR es.id IS DISTINCT FROM NEW.id);

  IF existing_count >= cap THEN
    RAISE EXCEPTION 'Elective is at capacity (%/%).', existing_count, cap
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS elective_signups_capacity_check ON public.elective_signups;

CREATE TRIGGER elective_signups_capacity_check
  BEFORE INSERT OR UPDATE OF elective_id, week_start_date, day_of_week, period
  ON public.elective_signups
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_elective_signup_capacity();

CREATE OR REPLACE FUNCTION public.get_elective_slot_counts(
  p_company_id uuid,
  p_week_start date,
  p_day_of_week text,
  p_period text
)
RETURNS TABLE (elective_id uuid, signup_count bigint)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (
    public.is_super_admin(auth.uid())
    OR p_company_id = public.get_user_company(auth.uid())
  ) THEN
    RAISE EXCEPTION 'Not authorized to view elective slot counts';
  END IF;

  RETURN QUERY
  SELECT es.elective_id, count(*)::bigint AS signup_count
  FROM public.elective_signups es
  WHERE es.company_id = p_company_id
    AND es.week_start_date = p_week_start
    AND es.day_of_week = p_day_of_week
    AND es.period = p_period
  GROUP BY es.elective_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_elective_slot_counts(uuid, date, text, text) TO authenticated;
