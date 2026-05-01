-- Auto-fail CampMinder sync_jobs stuck in running/pending (Edge timeouts leave orphans).
-- Call from pg_cron hourly, or manually: SELECT public.cleanup_stale_campminder_sync_jobs(120);

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
    AND j.created_at < now() - (interval '1 minute' * stale_after_minutes);

  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RETURN updated_count;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_campminder_sync_jobs(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_campminder_sync_jobs(integer) TO postgres;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_campminder_sync_jobs(integer) TO service_role;

-- Optional: uncomment after pg_cron is enabled (see prior migrations).
-- SELECT cron.schedule(
--   'cleanup-stale-campminder-sync-jobs',
--   '15 * * * *',
--   $$SELECT public.cleanup_stale_campminder_sync_jobs(120)$$
-- );
