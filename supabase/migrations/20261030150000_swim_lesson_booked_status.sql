-- Staff-approved lessons use status "booked" (legacy "scheduled" kept readable in app code).

UPDATE public.swim_lessons
SET status = 'booked'
WHERE status = 'scheduled';

COMMENT ON COLUMN public.swim_lessons.status IS
  'pending = awaiting admin; booked = on calendar; rejected; cancelled';
