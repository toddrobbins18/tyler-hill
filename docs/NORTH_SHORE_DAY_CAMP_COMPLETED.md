# North Shore Day Camp — Completed Work

**Camp:** North Shore Day Camp (`north-shore-day-camp`)  
**Platforms:** Web (`tyler-hill`) + Mobile (`Camp-Database-mobile-app`)  
**Last updated:** August 8, 2026

This document lists **what is built and in the codebase**. It does not include future work or items waiting on Todd’s API.

---

## 1. Foundation & platform

| Item | Web | Mobile | Notes |
|------|-----|--------|-------|
| `camp_type` on companies (`day_camp` vs `overnight`) | ✅ | ✅ | Drives menus and dashboard |
| North Shore company record + slug | ✅ SQL | — | `20260731120000_north_shore_day_camp_foundation.sql` |
| **Nursery Campers** division seeded | ✅ SQL | — | For Sunshine Report |
| Camp helpers (`isDayCampCompany`, `isNorthShoreDayCamp`) | ✅ | ✅ | `src/lib/camps.ts` / `constants/camps.ts` |
| Camp switcher (all active companies) | ✅ | ✅ | Super admins / multi-camp users |
| `CompanyContext` loads `camp_type` | ✅ | ✅ | |
| Multi-tenant RLS pattern | ✅ | ✅ | Existing Nest pattern reused per module |

---

## 2. UI shell (Nest look — not a separate app)

| Item | Web | Mobile |
|------|-----|--------|
| **Main Menu** — Todd carryover modules (alphabetical) | ✅ | ✅ |
| **Day Camp** sidebar section — Nest 2.0 / POC modules | ✅ | ✅ |
| Day camp dashboard (search + camper count + quick actions) | ✅ | ✅ standard Nest dashboard (no overnight athletics widgets) |
| Role Permissions — day-camp menu IDs | ✅ | ✅ |
| Placeholder screens for unbuilt modules | ✅ | ✅ |
| Menu permission gates (`ProtectedRoute` / `MenuPermissionGate`) | ✅ | ✅ |
| Daily news branding uses company name (not Tyler Hill default) | ✅ | ✅ |
| Bear PDFs hidden on day camps | ✅ | ✅ |

**Menu config:** `src/lib/dayCampMenu.ts` (web) · `src/constants/dayCampMenu.ts` (mobile)

---

## 3. Nest carryover modules (reuse existing pages, company-scoped)

All work on **web + mobile** unless noted.

| Module | Route / screen | Status |
|--------|----------------|--------|
| Activities & Field Trips | `/activities` | ✅ |
| Appointments | `/appointments` | ✅ Enabled for all day camps |
| Camper (roster) | `/roster` | ✅ |
| Daily news | `/notes` | ✅ |
| Dashboard | `/` | ✅ Day camp variant |
| Incident Reports | `/incidents` | ✅ |
| Master Calendar | `/calendar` | ✅ |
| Menu | `/menu` | ✅ |
| Messages | `/messages` | ✅ |
| Rainy Day Schedule | `/rainy-day` | ✅ |
| Special Events | `/special-events` | ✅ |
| Staff | `/staff` | ✅ |
| Transportation | `/transportation` | ✅ Nest module (not new routing engine) |
| Reports (Reporting Center) | `/reports` | ✅ |
| **Admin Panel** | `/admin` | ✅ Per-company permissions |
| **Role Permissions** | `/role-permissions` | ✅ Refetch on camp switch |
| **Division Permissions** | `/division-permissions` | ✅ |
| **User Approvals** | `/user-approvals` | ✅ |
| **Evaluation Questions** | `/evaluation-questions` | ✅ |
| **Specialist Sport Assignments** | `/specialist-sport-assignments` | ✅ |

**Phase 3 verify scripts:** `supabase/scripts/north_shore_phase_3_1_enable_modules.sql` through `north_shore_phase_3_5_enable_modules.sql`

---

## 4. New day-camp features (built)

| Feature | Web route | Mobile | Database | Data source |
|---------|-----------|--------|----------|-------------|
| **Sunshine Report** | `/day-camp/sunshine-report` | ✅ | ✅ `20260805000000_sunshine_report_multi_tenant.sql` | Manual entry / CSV import; groups flexible (not hardcoded to Ducklings etc.) |
| **Office Changes** | `/day-camp/office-changes` | ✅ | ✅ `20260805000001_office_transport_changes.sql` | Supabase; transport email hook pending |
| **Swim Lessons** | `/day-camp/swim-lessons` | ✅ | ✅ `20260806000000_swim_lessons.sql` | Supabase (`children` + company scope) |
| **Swim** (bracelets + level report tabs) | `/day-camp/swim` | ✅ | — | **Mock/local state** (same as camp-hug-hub POC) |
| **Health Center / Nurse** | `/day-camp/nurse` | ✅ | ✅ `20260806000001_nurse_records.sql` | Supabase; separate from sleepaway Nurse |
| **Bunking** | `/day-camp/bunking` | ✅ | ✅ `20260805000002_bunking_boards.sql` | Import/optimizer UI; Todd Jul 30 said skip — built anyway |
| **Global search** (dashboard) | ✅ | — | — | Name, phone, email, address |

**Still placeholder only**

| Feature | Route | Status |
|---------|-------|--------|
| Parent Portal | `/day-camp/parent-portal` | Placeholder |

---

## 5. Bug fixes & polish (North Shore–related)

| Fix | Area |
|-----|------|
| Dashboard widget layout — stable grid (no masonry jump) | Web dashboard |
| Three Day Outlook — removed nested scroll | Mobile dashboard |
| Special Events refetch on camp switch | Web |
| Appointments enabled for day camps (`appointmentsEnabledForCompany`) | Web + mobile |
| Admin Panel — per-company permission gate (not global admin only) | Web |
| Evaluation form — duplicate questions deduped + import guard | Web (`EvaluateStaffDialog`, `EvaluationQuestions`) |
| SQL script to deactivate duplicate eval questions | `supabase/scripts/fix_duplicate_evaluation_questions.sql` |

---

## 6. SQL & scripts (written — run in Supabase as needed)

### Required foundation
- `supabase/migrations/20260731120000_north_shore_day_camp_foundation.sql`
- `supabase/scripts/setup_north_shore_day_camp_foundation.sql` (same, for SQL Editor)

### Day-camp feature tables
- `20260805000000_sunshine_report_multi_tenant.sql`
- `20260805000001_office_transport_changes.sql`
- `20260805000002_bunking_boards.sql`
- `20260806000000_swim_lessons.sql`
- `20260806000001_nurse_records.sql`

### Phase 3 enable / verify (permissions + checks)
- `north_shore_phase_3_1_enable_modules.sql` — Camper, Staff, Messages
- `north_shore_phase_3_2_enable_modules.sql` — Calendar, Menu, Daily news
- `north_shore_phase_3_3_enable_modules.sql` — Activities, Special Events, Rainy Day
- `north_shore_phase_3_4_enable_modules.sql` — Appointments, Incidents, Reports
- `north_shore_phase_3_5_enable_modules.sql` — Admin + specialist-sport-assignments seed

### Optional demo data
- `bootstrap_north_shore_master_calendar_from_tyler_hill.sql`
- `bootstrap_north_shore_master_calendar_from_tyler_hill_force.sql`

### Other fixes
- `fix_appointment_notification_trigger_url.sql`
- `fix_duplicate_evaluation_questions.sql`

**Note:** Role permissions in foundation still use legacy IDs (`swim-bracelets`, `swim-progress`) and have `nurse` disabled. New menu IDs (`swim`, `swim-lessons`, `nurse`) may need a permissions update script after migrations run.

---

## 7. Key file locations

| Area | Web | Mobile |
|------|-----|--------|
| Camp helpers | `src/lib/camps.ts` | `src/constants/camps.ts` |
| Menus | `src/lib/dayCampMenu.ts` | `src/constants/dayCampMenu.ts` |
| Day camp pages | `src/pages/daycamp/*` | `src/screens/*Screen.tsx` |
| Bunking | `src/pages/Bunking.tsx` | `src/screens/BunkingScreen.tsx` |
| Routing | `src/App.tsx`, `DashboardRouter.tsx` | `src/navigation/AppNavigator.tsx` |
| Company context | `src/contexts/CompanyContext.tsx` | `src/contexts/CompanyContext.tsx` |

---

## 8. Planning docs (reference)

| Doc | Purpose |
|-----|---------|
| `docs/DAY_CAMP_PHASES.md` | Full phase tracker (done + future) |
| `docs/DAY_CAMP_EXPANSION_PLAN.md` | Camp-by-camp expansion plan |
| **`docs/NORTH_SHORE_DAY_CAMP_COMPLETED.md`** | This file — completed work only |

---

## 9. Summary

**Completed:** Foundation, UI shell, all Nest carryover modules (web + mobile), Sunshine Report, Office Changes, Swim Lessons, Swim UI (mock), Health Center, Bunking, global search, admin/permissions wiring, and several UX/bug fixes.

**Not in this doc:** Parent Portal, email notification workflows, Todd API data import, Hampton/Southampton camps, UAT/go-live.
