#!/usr/bin/env bash
# Backfill guardian emails for North Shore Day Camp from CampMinder.
# Run from tyler-hill/ after deploying populate-guardian-emails.
#
# Usage:
#   export SUPABASE_ANON_KEY="your-anon-key"
#   ./supabase/scripts/backfill_north_shore_guardian_emails.sh

set -euo pipefail

PROJECT_URL="${SUPABASE_URL:-https://qjbkvnzeejbqxbcbskdu.supabase.co}"
ANON_KEY="${SUPABASE_ANON_KEY:?Set SUPABASE_ANON_KEY}"
# Default: 2027 (operational season). Set SEASONS="2027" or "2027 2026" to control.
SEASONS="${SEASONS:-2027 2026}"
BATCH_SIZE="${BATCH_SIZE:-50}"
MAX_RUNS="${MAX_RUNS:-25}"

for SEASON in $SEASONS; do
echo ""
echo "========== North Shore season ${SEASON} =========="

for ((i=1; i<=MAX_RUNS; i++)); do
  echo "--- Run ${i}/${MAX_RUNS} ---"
  RESP=$(curl -sS -X POST "${PROJECT_URL}/functions/v1/populate-guardian-emails" \
    -H "Authorization: Bearer ${ANON_KEY}" \
    -H "Content-Type: application/json" \
    -d "{\"company\":\"north-shore-day-camp\",\"season\":\"${SEASON}\",\"batch_size\":${BATCH_SIZE}}")

  echo "$RESP" | python3 -m json.tool 2>/dev/null || echo "$RESP"

  REMAINING=$(echo "$RESP" | python3 -c "import sys,json; r=json.load(sys.stdin).get('results',[]); print(r[0].get('remaining',0) if r else 0)" 2>/dev/null || echo "?")
  UPDATED=$(echo "$RESP" | python3 -c "import sys,json; r=json.load(sys.stdin).get('results',[]); print(r[0].get('updated',0) if r else 0)" 2>/dev/null || echo "?")

  echo "Updated: ${UPDATED}, Remaining: ${REMAINING}"

  if [[ "$REMAINING" == "0" ]]; then
    echo "Season ${SEASON} done — no campers left without guardian email."
    break
  fi

  sleep 3
done

if [[ "$REMAINING" != "0" ]]; then
  echo "Season ${SEASON}: stopped after ${MAX_RUNS} runs with ${REMAINING} still remaining (retry or increase MAX_RUNS)."
fi
done

echo ""
echo "All requested seasons processed. Re-run Sunshine roster sync or refresh parent emails in the app."
