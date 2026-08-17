#!/usr/bin/env bash
# Deploy missing daily email edge functions to production.
# Prerequisite: run `npx supabase login` once (opens browser).

set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_REF="${SUPABASE_PROJECT_REF:-qjbkvnzeejbqxbcbskdu}"

echo "Deploying notification edge functions to project ${PROJECT_REF}..."
npx supabase functions deploy send-daily-dashboard --project-ref "${PROJECT_REF}"
npx supabase functions deploy send-daily-health-center-log --project-ref "${PROJECT_REF}"
npx supabase functions deploy send-daily-tutoring-summary --project-ref "${PROJECT_REF}"
npx supabase functions deploy send-tomorrow-rosters --project-ref "${PROJECT_REF}"
npx supabase functions deploy check-medication-alerts --project-ref "${PROJECT_REF}"
npx supabase functions deploy process-scheduled-notifications --project-ref "${PROJECT_REF}"
npx supabase functions deploy send-incident-notification --project-ref "${PROJECT_REF}"
npx supabase functions deploy send-health-center-notification --project-ref "${PROJECT_REF}"

echo "Done. Invoke send-daily-dashboard from Supabase Dashboard → Edge Functions → Invoke to test."
