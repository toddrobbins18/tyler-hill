# North Shore Day Camp — Smoke Test

**Camp:** `north-shore-day-camp`  
**Season:** `2026` (match header in app)  
**Where:** Supabase SQL Editor + `thenest.camp` (or localhost)

Use this after deploy, sync, or calendar cleanup to confirm North Shore works and is isolated from Tyler Hill.

---

## Part 1 — Database (5 min)

1. Open **Supabase → SQL Editor**.
2. Run:

   `supabase/scripts/north_shore_smoke_test.sql`

3. Review the result table:

| Status | Meaning |
|--------|---------|
| **PASS** | OK |
| **FAIL** | Fix before go-live |
| **WARN** | Review (empty calendar and pending `group_name` sync are common) |
| **INFO** | Context only |

### Expected today (after calendar clear)

| Check | Expected |
|-------|----------|
| `foundation.*` | All **PASS** |
| `roster.campers_season_2026` | **PASS** (campers > 0) |
| `roster.group_name_from_campminder` | **WARN** until CampMinder custom fields sync |
| `calendar.special_events_not_tyler_hill_copy` | **PASS** with `ns_special_events=0` |
| `sync.latest_job_completed` | **PASS** after Admin Panel sync |

---

## Part 2 — Web UI (15 min)

Log in as a user with **North Shore** access. Set season **2026** in the header.

### A. App loads

| Step | Pass? |
|------|-------|
| Switch camp → **North Shore Day Camp** | ☐ |
| Dashboard loads (no blank/white screen) | ☐ |
| Sidebar shows **Day Camp** section (Sunshine, Office Changes, Swim, etc.) | ☐ |
| **Bunking / Hiring / Media** are **hidden** for North Shore | ☐ |

### B. Roster (CampMinder data)

| Step | Pass? |
|------|-------|
| **Camper** → list loads with campers | ☐ |
| Sort by **Group** available (day camp) | ☐ |
| Open a camper profile → loads (no crash) | ☐ |
| **Birthday** tab hidden for day camp (if deployed) | ☐ |

### C. Calendar modules (isolation)

| Step | Pass? |
|------|-------|
| **Special Events** → empty state message (not Tyler Hill events) | ☐ |
| **Activities & Field Trips** → empty or NS-only data | ☐ |
| **Master Calendar** → empty or NS-only data | ☐ |
| Switch to **Tyler Hill** → Special Events shows ~345 events | ☐ |
| Switch back to **North Shore** → empty again | ☐ |

### D. Round-trip write test (Special Events)

Proves create/read/delete works for North Shore:

1. On North Shore → **Special Events** → **+ Add Event**
2. Title: `SMOKE TEST — DELETE ME`, date: any day in 2026, type: **other**
3. Save → event appears in list
4. Delete the event → list empty again

| Step | Pass? |
|------|-------|
| Add event succeeds | ☐ |
| Event visible only on North Shore (check Tyler Hill — should not appear) | ☐ |
| Delete succeeds | ☐ |

### E. Day-camp features

| Module | Pass? |
|--------|-------|
| **Sunshine Report** — page loads, can open form | ☐ |
| **Office Changes** — page loads | ☐ |
| **Health Center** (`/day-camp/nurse`) — page loads, add test record (optional) | ☐ |
| **Swim Lessons** — page loads | ☐ |
| **Daily news** — title uses North Shore (not “Tyler Hill Daily News”) | ☐ |

### F. CampMinder sync

| Step | Pass? |
|------|-------|
| **Admin Panel** → run **Campers Only** sync for North Shore, season **2026** | ☐ |
| Sync job completes (check Admin or SQL `sync_jobs`) | ☐ |
| Camper count unchanged or updated (not zero) | ☐ |

---

## Part 3 — Pass / fail criteria

**Smoke test PASSES** when:

- All **FAIL** rows in SQL are resolved
- UI sections A–C pass
- Round-trip test (D) passes
- Tyler Hill data does **not** appear on North Shore

**Acceptable WARNs** (not blockers for empty calendar):

- `calendar.*` counts = 0 (add real NS schedule via CSV or **+ Add Event**)
- `roster.group_name_from_campminder` = WARN until CampMinder field mapping is confirmed

---

## Quick SQL only (Special Events isolation)

```sql
SELECT c.slug, COUNT(*) AS special_events
FROM public.special_events_activities s
JOIN public.companies c ON c.id = s.company_id
WHERE c.slug IN ('north-shore-day-camp', 'tyler-hill-camp')
  AND (s.season = '2026' OR s.season IS NULL)
GROUP BY c.slug;
```

Expected: **north-shore-day-camp = 0** (or NS-only events you added), **tyler-hill-camp = 345**.
