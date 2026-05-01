-- Stale CampMinder sync cleanup: running jobs use updated_at (progress heartbeats)
-- so long camper person fetch is not killed solely because created_at is old.
-- Pending jobs still use created_at (never transitioned to running).

CREATE OR REPLACE FUNCTION public.cleanup_stale_campminder_sync_jobs(
  stale_after_minutes integer DEFAULT 120
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  updated_count integer := 0;
BEGIN
  UPDATE public.sync_jobs j
  SET
    status = 'failed',
    completed_at = COALESCE(j.completed_at, now()),
    error_message = COALESCE(
      NULLIF(trim(j.error_message), ''),
      format(
        'Auto-marked failed: stale job older than %s minutes (Edge timeout or worker died)',
        stale_after_minutes
      )
    ),
    updated_at = now()
  WHERE j.entity_type = 'campminder'
    AND j.status IN ('running', 'pending')
    AND (
      (
        j.status = 'pending'
        AND j.created_at < now() - (interval '1 minute' * stale_after_minutes)
      )
      OR (
        j.status = 'running'
        AND j.updated_at < now() - (interval '1 minute' * stale_after_minutes)
      )
    );

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_campminder_sync_jobs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_campminder_sync_jobs(integer) TO postgres;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_campminder_sync_jobs(integer) TO service_role;
