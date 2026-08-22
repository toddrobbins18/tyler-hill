-- North Shore Day Camp — Smoke Test (database)
-- Run in Supabase SQL Editor (service role / postgres).
-- Camp slug: north-shore-day-camp | Season under test: 2026 (change @season if needed)
--
-- Result statuses:
--   PASS  — working as expected
--   FAIL  — broken; fix before go-live
--   WARN  — review manually (may be OK for empty calendar, pending sync, etc.)
--   INFO  — counts / context only

WITH ns AS (
  SELECT id, slug, name, camp_type, is_active
  FROM public.companies
  WHERE slug = 'north-shore-day-camp'
),
th AS (
  SELECT id FROM public.companies WHERE slug = 'tyler-hill-camp'
),
checks AS (
  -- ---------------------------------------------------------------------------
  -- Foundation
  -- ---------------------------------------------------------------------------
  SELECT
    1 AS sort_order,
    'foundation.company_exists' AS check_name,
    CASE WHEN EXISTS (SELECT 1 FROM ns) THEN 'PASS' ELSE 'FAIL' END AS status,
    COALESCE((SELECT name FROM ns), 'north-shore-day-camp row missing') AS detail

  UNION ALL
  SELECT 2, 'foundation.camp_type_day_camp',
    CASE WHEN (SELECT camp_type FROM ns) = 'day_camp' THEN 'PASS' ELSE 'FAIL' END,
    'camp_type=' || COALESCE((SELECT camp_type::text FROM ns), 'NULL')

  UNION ALL
  SELECT 3, 'foundation.company_active',
    CASE WHEN COALESCE((SELECT is_active FROM ns), false) THEN 'PASS' ELSE 'FAIL' END,
    'is_active=' || COALESCE((SELECT is_active::text FROM ns), 'NULL')

  UNION ALL
  SELECT 4, 'foundation.active_divisions',
    CASE WHEN (
      SELECT COUNT(*) FROM public.divisions d
      JOIN ns ON d.company_id = ns.id
      WHERE d.is_active = true
    ) >= 1 THEN 'PASS' ELSE 'FAIL' END,
    'active_divisions=' || (
      SELECT COUNT(*)::text FROM public.divisions d
      JOIN ns ON d.company_id = ns.id WHERE d.is_active = true
    )

  UNION ALL
  SELECT 5, 'foundation.admin_menu_permissions',
    CASE WHEN (
      SELECT COUNT(*) FROM public.role_permissions rp
      JOIN ns ON rp.company_id = ns.id
      WHERE rp.role = 'admin' AND rp.can_access = true
        AND rp.menu_item IN ('dashboard', 'roster', 'special-events', 'calendar', 'activities', 'health-center', 'sunshine-report')
    ) >= 7 THEN 'PASS' ELSE 'FAIL' END,
    'core_admin_menus=' || (
      SELECT COUNT(*)::text FROM public.role_permissions rp
      JOIN ns ON rp.company_id = ns.id
      WHERE rp.role = 'admin' AND rp.can_access = true
        AND rp.menu_item IN ('dashboard', 'roster', 'special-events', 'calendar', 'activities', 'health-center', 'sunshine-report')
    )

  -- ---------------------------------------------------------------------------
  -- CampMinder roster (season 2026)
  -- ---------------------------------------------------------------------------
  UNION ALL
  SELECT 10, 'roster.campers_season_2026',
    CASE WHEN (
      SELECT COUNT(*) FROM public.children ch
      JOIN ns ON ch.company_id = ns.id
      WHERE ch.season = '2026'
    ) > 0 THEN 'PASS' ELSE 'FAIL' END,
    'campers_2026=' || (
      SELECT COUNT(*)::text FROM public.children ch
      JOIN ns ON ch.company_id = ns.id WHERE ch.season = '2026'
    )

  UNION ALL
  SELECT 11, 'roster.staff_any_season',
    CASE WHEN (
      SELECT COUNT(*) FROM public.staff s JOIN ns ON s.company_id = ns.id
    ) > 0 THEN 'PASS' ELSE 'WARN' END,
    'staff_rows=' || (
      SELECT COUNT(*)::text FROM public.staff s JOIN ns ON s.company_id = ns.id
    )

  UNION ALL
  SELECT 12, 'roster.group_name_from_campminder',
    CASE
      WHEN (
        SELECT COUNT(*) FROM public.children ch
        JOIN ns ON ch.company_id = ns.id
        WHERE ch.season = '2026' AND NULLIF(TRIM(ch.group_name), '') IS NOT NULL
      ) > 0 THEN 'PASS'
      WHEN (
        SELECT COUNT(*) FROM public.children ch
        JOIN ns ON ch.company_id = ns.id WHERE ch.season = '2026'
      ) = 0 THEN 'INFO'
      ELSE 'WARN'
    END,
    'with_group_name=' || (
      SELECT COUNT(*)::text FROM public.children ch
      JOIN ns ON ch.company_id = ns.id
      WHERE ch.season = '2026' AND NULLIF(TRIM(ch.group_name), '') IS NOT NULL
    ) || ' / total_2026=' || (
      SELECT COUNT(*)::text FROM public.children ch
      JOIN ns ON ch.company_id = ns.id WHERE ch.season = '2026'
    )

  UNION ALL
  SELECT 13, 'roster.no_tyler_hill_division_names',
    CASE WHEN NOT EXISTS (
      SELECT 1
      FROM public.divisions d
      JOIN ns ON d.company_id = ns.id
      WHERE d.is_active = true
        AND d.name ~* '(freshmen|sophomore|junior|senior|super|teen|cit)\s'
    ) THEN 'PASS' ELSE 'WARN' END,
    'overnight-style division names may indicate wrong camp data'

  -- ---------------------------------------------------------------------------
  -- Latest CampMinder sync
  -- ---------------------------------------------------------------------------
  UNION ALL
  SELECT 20, 'sync.latest_job_completed',
    CASE
      WHEN NOT EXISTS (
        SELECT 1 FROM public.sync_jobs j JOIN ns ON j.company_id = ns.id
        WHERE j.entity_type = 'campminder'
      ) THEN 'WARN'
      WHEN (
        SELECT j.status FROM public.sync_jobs j
        JOIN ns ON j.company_id = ns.id
        WHERE j.entity_type = 'campminder'
        ORDER BY j.created_at DESC LIMIT 1
      ) = 'completed' THEN 'PASS'
      ELSE 'FAIL'
    END,
    COALESCE((
      SELECT j.status || ' @ ' || j.created_at::text
      FROM public.sync_jobs j
      JOIN ns ON j.company_id = ns.id
      WHERE j.entity_type = 'campminder'
      ORDER BY j.created_at DESC LIMIT 1
    ), 'no sync_jobs rows')

  UNION ALL
  SELECT 21, 'sync.recent_within_7_days',
    CASE WHEN EXISTS (
      SELECT 1 FROM public.sync_jobs j
      JOIN ns ON j.company_id = ns.id
      WHERE j.entity_type = 'campminder'
        AND j.status = 'completed'
        AND j.created_at >= now() - interval '7 days'
    ) THEN 'PASS' ELSE 'WARN' END,
    'last_completed=' || COALESCE((
      SELECT j.created_at::text FROM public.sync_jobs j
      JOIN ns ON j.company_id = ns.id
      WHERE j.entity_type = 'campminder' AND j.status = 'completed'
      ORDER BY j.created_at DESC LIMIT 1
    ), 'none')

  -- ---------------------------------------------------------------------------
  -- Calendar isolation (no Tyler Hill bootstrap copy)
  -- ---------------------------------------------------------------------------
  UNION ALL
  SELECT 30, 'calendar.special_events_not_tyler_hill_copy',
    CASE
      WHEN (SELECT COUNT(*) FROM public.special_events_activities s JOIN ns ON s.company_id = ns.id) = 0 THEN 'PASS'
      WHEN (
        SELECT COUNT(*) FROM public.special_events_activities s JOIN ns ON s.company_id = ns.id
      ) = (
        SELECT COUNT(*) FROM public.special_events_activities s JOIN th ON s.company_id = th.id
        WHERE s.season = '2026' OR s.season IS NULL
      ) THEN 'WARN'
      ELSE 'PASS'
    END,
    'ns_special_events=' || (
      SELECT COUNT(*)::text FROM public.special_events_activities s JOIN ns ON s.company_id = ns.id
    ) || ' | th_2026=' || (
      SELECT COUNT(*)::text FROM public.special_events_activities s JOIN th ON s.company_id = th.id
      WHERE s.season = '2026' OR s.season IS NULL
    )

  UNION ALL
  SELECT 31, 'calendar.activities_not_tyler_hill_copy',
    CASE
      WHEN (SELECT COUNT(*) FROM public.activities_field_trips a JOIN ns ON a.company_id = ns.id) = 0 THEN 'PASS'
      WHEN (
        SELECT COUNT(*) FROM public.activities_field_trips a JOIN ns ON a.company_id = ns.id
      ) = (
        SELECT COUNT(*) FROM public.activities_field_trips a JOIN th ON a.company_id = th.id
        WHERE a.season = '2026' OR a.season IS NULL
      ) THEN 'WARN'
      ELSE 'PASS'
    END,
    'ns_activities=' || (
      SELECT COUNT(*)::text FROM public.activities_field_trips a JOIN ns ON a.company_id = ns.id
    ) || ' | th_2026=' || (
      SELECT COUNT(*)::text FROM public.activities_field_trips a JOIN th ON a.company_id = th.id
      WHERE a.season = '2026' OR a.season IS NULL
    )

  UNION ALL
  SELECT 32, 'calendar.sports_not_tyler_hill_copy',
    CASE
      WHEN (SELECT COUNT(*) FROM public.sports_calendar sc JOIN ns ON sc.company_id = ns.id) = 0 THEN 'PASS'
      WHEN (
        SELECT COUNT(*) FROM public.sports_calendar sc JOIN ns ON sc.company_id = ns.id
      ) = (
        SELECT COUNT(*) FROM public.sports_calendar sc JOIN th ON sc.company_id = th.id
        WHERE sc.season = '2026' OR sc.season IS NULL
      ) THEN 'WARN'
      ELSE 'PASS'
    END,
    'ns_sports=' || (
      SELECT COUNT(*)::text FROM public.sports_calendar sc JOIN ns ON sc.company_id = ns.id
    ) || ' | th_2026=' || (
      SELECT COUNT(*)::text FROM public.sports_calendar sc JOIN th ON sc.company_id = th.id
      WHERE sc.season = '2026' OR sc.season IS NULL
    )

  -- ---------------------------------------------------------------------------
  -- Day-camp feature tables (scoped to North Shore)
  -- ---------------------------------------------------------------------------
  UNION ALL
  SELECT 40, 'features.nurse_rls_helper',
    CASE WHEN EXISTS (
      SELECT 1 FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      WHERE n.nspname = 'public' AND p.proname = 'user_can_manage_nurse_records'
    ) THEN 'PASS' ELSE 'FAIL' END,
    'function user_can_manage_nurse_records'

  UNION ALL
  SELECT 41, 'features.sunshine_report_tables',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'sunshine_reports'
    ) THEN 'PASS' ELSE 'FAIL' END,
    'groups=' || COALESCE((
      SELECT COUNT(*)::text FROM public.sunshine_groups g JOIN ns ON g.company_id = ns.id
    ), '0') || ' reports=' || COALESCE((
      SELECT COUNT(*)::text FROM public.sunshine_reports r JOIN ns ON r.company_id = ns.id
    ), '0')

  UNION ALL
  SELECT 42, 'features.office_changes_table',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'office_transport_changes'
    ) THEN 'PASS' ELSE 'FAIL' END,
    'rows_ns=' || COALESCE((
      SELECT COUNT(*)::text FROM public.office_transport_changes o
      JOIN ns ON o.company_id = ns.id
    ), 'table missing')

  UNION ALL
  SELECT 43, 'features.swim_lessons_table',
    CASE WHEN EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'swim_lessons'
    ) THEN 'PASS' ELSE 'FAIL' END,
    'rows_ns=' || COALESCE((
      SELECT COUNT(*)::text FROM public.swim_lessons sl
      JOIN ns ON sl.company_id = ns.id
    ), 'table missing')

  -- ---------------------------------------------------------------------------
  -- Cross-camp leak (same child id under two companies — should never happen)
  -- ---------------------------------------------------------------------------
  UNION ALL
  SELECT 50, 'isolation.no_shared_camper_ids_with_tyler_hill',
    CASE WHEN NOT EXISTS (
      SELECT 1
      FROM public.children ns_ch
      JOIN ns ON ns_ch.company_id = ns.id
      JOIN public.children th_ch ON th_ch.id = ns_ch.id
      JOIN th ON th_ch.company_id = th.id
    ) THEN 'PASS' ELSE 'FAIL' END,
    'duplicate primary keys across camps'

  UNION ALL
  SELECT 51, 'isolation.calendar_rows_use_north_shore_company_id',
    CASE WHEN NOT EXISTS (
      SELECT 1 FROM public.special_events_activities s
      JOIN ns ON s.company_id = ns.id
      WHERE s.company_id <> (SELECT id FROM ns)
    ) THEN 'PASS' ELSE 'FAIL' END,
    'all NS special_events have NS company_id'
)
SELECT
  check_name,
  status,
  detail
FROM checks
ORDER BY sort_order;

-- =============================================================================
-- Summary counts (INFO)
-- =============================================================================

SELECT '--- SUMMARY ---' AS section;

SELECT
  'campers_2026' AS metric,
  COUNT(*) AS value
FROM public.children ch
JOIN public.companies c ON c.id = ch.company_id
WHERE c.slug = 'north-shore-day-camp' AND ch.season = '2026'

UNION ALL
SELECT 'staff', COUNT(*)
FROM public.staff s
JOIN public.companies c ON c.id = s.company_id
WHERE c.slug = 'north-shore-day-camp'

UNION ALL
SELECT 'special_events', COUNT(*)
FROM public.special_events_activities e
JOIN public.companies c ON c.id = e.company_id
WHERE c.slug = 'north-shore-day-camp'

UNION ALL
SELECT 'activities', COUNT(*)
FROM public.activities_field_trips a
JOIN public.companies c ON c.id = a.company_id
WHERE c.slug = 'north-shore-day-camp'

UNION ALL
SELECT 'sports_calendar', COUNT(*)
FROM public.sports_calendar sc
JOIN public.companies c ON c.id = sc.company_id
WHERE c.slug = 'north-shore-day-camp';

-- =============================================================================
-- Latest North Shore sync job (detail)
-- =============================================================================

SELECT
  j.id,
  j.status,
  j.created_at,
  j.completed_at,
  j.error_message,
  j.progress->>'syncType' AS sync_type,
  j.progress->>'step' AS last_step,
  j.total_counts
FROM public.sync_jobs j
JOIN public.companies c ON c.id = j.company_id
WHERE c.slug = 'north-shore-day-camp'
  AND j.entity_type = 'campminder'
ORDER BY j.created_at DESC
LIMIT 3;
