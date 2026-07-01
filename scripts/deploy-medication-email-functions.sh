#!/usr/bin/env bash
# Deploy medication edge functions to production.
# Prerequisite: run `npx supabase login` once, and apply migration 20260701160000.

set -euo pipefail
cd "$(dirname "$0")/.."

PROJECT_REF="${SUPABASE_PROJECT_REF:-qjbkvnzeejbqxbcbskdu}"

echo "Deploying medication functions to project ${PROJECT_REF}..."
npx supabase functions deploy generate-daily-medications --project-ref "${PROJECT_REF}"
npx supabase functions deploy check-medication-alerts --project-ref "${PROJECT_REF}"

echo "Done. Apply migration 20260701160000_schedule_medication_email_crons.sql if not already on prod."
