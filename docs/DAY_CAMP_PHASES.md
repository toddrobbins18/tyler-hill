# North Shore Day Camp — Phase Tracker

**Started:** July 31, 2026  
**Camp:** North Shore Day Camp only (for now)  
**Workflow:** Ask Ansar before starting any step. Update this doc after each completed step.

**Related docs:** [DAY_CAMP_EXPANSION_PLAN.md](./DAY_CAMP_EXPANSION_PLAN.md)

---

## Todd direction — source of truth (original email)

> **Same Nest** — structure, functionality, and UX stay the same. Not a separate app.  
> Expand for **3 day camps:** North Shore, Hampton Country, Southampton.

### Carry over from existing Nest (reuse pages)

- Activities and Field Trips  
- Appointments  
- Camper  
- Daily news  
- Dashboard  
- Incident Reports  
- Master Calendar  
- Menu  
- Messages  
- **Nurse → Health Center** (new features, not current Nurse)  
- Rainy Day Schedule  
- Special Events  
- Staff  
- **All Admin items**

### Day Camp menu (Nest 2.0 + Airtable POC — new build)

Incorporate into a **Day Camp** section/dropdown — e.g. Sunshine Report, Transport, Swim, Office Changes, Parent Portal, etc.  
*(Jul 30 email: North Shore first; skip Hiring, Bunking, Media for now.)*

### UI rule

**Look like The Nest** (Main Menu sidebar + standard dashboard) — **not** a separate CampHub app shell.

---

## Todd scope update (Jul 30 email — North Shore v1 detail)

| Build now | Skip for now |
|-----------|--------------|
| Sunshine Report (Nursery Campers only) | Hiring |
| Swim Bracelets report | Bunking |
| Swim Progress reports | Media |
| Health Center (day camp — separate from sleepaway) | |
| Office Changes | |
| Parent Portal (SSO → swim lessons + transport requests) | |
| Nest carryover modules | |
| **North Shore only** | Hampton & Southampton later |

**Data:** Todd will provide API per camp when ready.

---

## Status at a glance

| | Phase | Status |
|---|-------|--------|
| ✅ | **Completed** | Phases 0–2 (foundation + day camp UI shell) |
| ⏳ | **Current / next** | Phase 3 — Nest carryover modules + Phase 4 features |
| 📋 | **Future** | Phases 5–8 |

---

## How we work

1. **Before any step** — assistant asks: *"Ready to start Phase X, Step Y?"*
2. **Ansar approves** — then work begins
3. **After step completes** — update this doc + report: completed / previous / next
4. **No surprise work** — no code, SQL, or deploy without permission
5. **Web + mobile parity** — every North Shore / day-camp change ships in **both** `tyler-hill` (web) and `Camp-Database-mobile-app` (mobile) in the same step. No web-only features.

### Web + mobile parity checklist (Phase 2 shell)

| Area | Web | Mobile |
|------|-----|--------|
| `camp_type` / `isDayCamp` | ✅ | ✅ |
| Camp switcher (all active companies) | ✅ | ✅ |
| Main Menu + Day Camp sidebar | ✅ | ✅ |
| Day Camp placeholder screens | ✅ | ✅ |
| Standard Dashboard (no athletics on day camp) | ✅ | ✅ |
| Role Permissions (day-camp menu IDs) | ✅ | ✅ |

---

## Phase 0 — Planning ✅ COMPLETED

| Step | Description | Status |
|------|-------------|--------|
| 0.1 | Review Todd emails (expansion + Jul 30 details) | ✅ Done |
| 0.2 | Create camp-by-camp plan doc | ✅ Done |
| 0.3 | Create phase tracker (this doc) | ✅ Done |
| 0.4 | Todd sign-off on North Shore v1 scope | ⏸ Pending |

---

## Phase 1 — Foundation ✅ CODE DONE (run SQL to activate)

**Goal:** North Shore exists in the system; camp type drives day-camp vs overnight UI.

| Step | Description | Status | Permission |
|------|-------------|--------|------------|
| 1.1 | Add `camp_type` on `companies` — migration | ✅ Written | — |
| 1.2 | Create North Shore company record (slug, name, theme) | ✅ Written | — |
| 1.3 | Add `north-shore-day-camp` to `src/lib/camps.ts` + helpers | ✅ Done | — |
| 1.4 | Seed **Nursery Campers** division | ✅ Written | — |
| 1.5 | Role permissions for North Shore (day-camp menu IDs) | ✅ Written | — |
| 1.6 | `CompanyContext` loads `camp_type` | ✅ Done | — |
| 1.7 | **Run SQL in Supabase** (migration or script) | ⏳ **Your action** | Required |

**Files:**
- `supabase/migrations/20260731120000_north_shore_day_camp_foundation.sql`
- `supabase/scripts/setup_north_shore_day_camp_foundation.sql`

**Exit criteria:** North Shore appears in camp switcher for super admins after SQL is run.

---

## Phase 2 — Day camp UI shell ✅ COMPLETED

**Goal:** Same Nest UX as overnight camps + Todd's menu structure.

| Step | Description | Status |
|------|-------------|--------|
| 2.1 | **Main Menu** — Todd carryover items (alphabetical) | ✅ Done |
| 2.2 | **Day Camp** section — Nest 2.0 / POC items | ✅ Done |
| 2.3 | Standard Nest **Dashboard** (not CampHub cards) | ✅ Done |
| 2.4 | Role Permissions aligned for day camps | ✅ Done |
| 2.5 | Placeholder routes for new modules | ✅ Done |
| 2.6 | Mobile `camps.ts` day camp helpers | ✅ Done |
| 2.7 | Mobile parity — sidebar, placeholders, role perms, dashboard | ✅ Done |

---

## Phase 3 — Nest carryover (reuse) ⏳ NEXT

**Goal:** Existing Nest pages work for North Shore with camp-scoped data.

| Step | Description | Status |
|------|-------------|--------|
| 3.1 | Enable Camper, Staff, Messages | ✅ Done |
| 3.2 | Enable Master Calendar, Menu, Daily news | ✅ Done |
| 3.3 | Enable Activities, Special Events, Rainy Day | ✅ Done |
| 3.4 | Enable Appointments, Incident Reports, Reports | ⬜ |
| 3.5 | Enable Admin (panel, roles, divisions) | ⬜ |

**Exit criteria:** Todd’s listed Nest modules usable on North Shore (with data).

**Phase 3.1 notes (Jul 31):**
- Camper (`/roster`), Staff, Messages already company-scoped on web — no slug hardcoding.
- Mobile: added `useMenuAccess` + `MenuPermissionGate` (parity with web `ProtectedRoute`).
- SQL: `supabase/scripts/north_shore_phase_3_1_enable_modules.sql` — division_leader Staff access + verify queries.
- **Your action:** Run Phase 3.1 SQL if foundation was already applied; assign users to North Shore via `user_roles`.
- Pages work empty until Phase 5 data import or CSV bootstrap.

**Phase 3.2 notes (Jul 31):**
- Master Calendar, Menu, Daily news already company-scoped — no slug blocks.
- Web/mobile: Daily news branding uses `company.name` for day camps (was defaulting to Tyler Hill / Timber Lake).
- Mobile: permission guards on Calendar, Menu, Daily news; Bear PDFs hidden except Tyler Hill.
- SQL verify: `supabase/scripts/north_shore_phase_3_2_enable_modules.sql`

**Phase 3.3 notes (Jul 31):**
- Activities, Special Events, Rainy Day already company-scoped — permissions in foundation SQL.
- Web: fixed Special Events refetch on camp switch (`currentCompany?.id` in effect deps).
- Mobile: permission guards on Activities, Special Events, Rainy Day screens.
- SQL verify: `supabase/scripts/north_shore_phase_3_3_enable_modules.sql`

---

## Phase 4 — New day-camp features 📋 FUTURE

Build in this order (Todd priority):

### 4A — Sunshine Report

| Step | Description | Status |
|------|-------------|--------|
| 4A.1 | Sunshine UI — Nursery Campers division only | ⬜ |
| 4A.2 | Groups sorted like Airtable | ⬜ |
| 4A.3 | Pull P1 Email per camper | ⬜ |
| 4A.4 | API / import integration (when Todd provides) | ⬜ |

### 4B — Swim Bracelets report

| Step | Description | Status |
|------|-------------|--------|
| 4B.1 | Report: all campers + group + P1 Email | ⬜ |
| 4B.2 | Approve-before-send workflow | ⬜ |
| 4B.3 | Admin bulk send | ⬜ |

### 4C — Swim Progress reports

| Step | Description | Status |
|------|-------------|--------|
| 4C.1 | Tie reports to division leader | ⬜ |
| 4C.2 | Show on child’s camper record | ⬜ |
| 4C.3 | Email division leader on enter/update | ⬜ |

### 4D — Health Center (day camp — separate)

| Step | Description | Status |
|------|-------------|--------|
| 4D.1 | Separate day-camp health module (do not break sleepaway Nurse) | ⬜ |
| 4D.2 | Email division leader — sent/called home | ⬜ |
| 4D.3 | Email directors + transportation — sent home | ⬜ |

### 4E — Office Changes

| Step | Description | Status |
|------|-------------|--------|
| 4E.1 | Office Changes entry UI | ⬜ |
| 4E.2 | Email transportation on entry | ⬜ |

### 4F — Parent Portal

| Step | Description | Status |
|------|-------------|--------|
| 4F.1 | Parent single sign-on (one login per parent) | ⬜ |
| 4F.2 | Swim lessons access | ⬜ |
| 4F.3 | Transportation requests access | ⬜ |

**Skipped (Todd):** Hiring, Bunking, Media — do not build until asked.

---

## Phase 5 — Data & API 📋 FUTURE

| Step | Description | Status |
|------|-------------|--------|
| 5.1 | Receive North Shore API from Todd | ⬜ |
| 5.2 | Import/sync campers, staff, groups | ⬜ |
| 5.3 | Map P1 Email, divisions, groups | ⬜ |
| 5.4 | Verify RLS — users only see North Shore data | ⬜ |

---

## Phase 6 — Email & notifications 📋 FUTURE

| Step | Trigger | Recipients |
|------|---------|------------|
| 6.1 | Swim Bracelets approved | P1 Email (bulk ok) |
| 6.2 | Swim Progress entered/updated | Division leader |
| 6.3 | Child sent/called home | Division leader |
| 6.4 | Child sent home | Directors + transportation |
| 6.5 | Office Change entered | Transportation |

---

## Phase 7 — UAT & go-live (North Shore) 📋 FUTURE

| Step | Description | Status |
|------|-------------|--------|
| 7.1 | Todd / camp director UAT | ⬜ |
| 7.2 | Fix issues from UAT | ⬜ |
| 7.3 | Staff training | ⬜ |
| 7.4 | North Shore go-live | ⬜ |

---

## Phase 8 — Later 📋 FUTURE

| Item | Notes |
|------|--------|
| Hampton Country Day Camp | Same UI as North Shore, new company + data |
| Southampton Camp & Club | Same UI as North Shore, new company + data |
| Bunking | When Todd asks |
| Media | When Todd asks |
| Hiring | When Todd asks |
| Health Center on sleepaway camps | Only if/when Todd wants — keep separate |

---

## Session log

| Date | Completed | Next |
|------|-----------|------|
| Jul 31, 2026 | Phase 0 — planning docs | — |
| Jul 31, 2026 | Phase 1 — migration run + foundation | Phase 2 UI shell |
| Jul 31, 2026 | Phase 2 — day camp UI shell | Phase 3 / 4 (with permission) |
| Jul 31, 2026 | Phase 3.1 — Camper, Staff, Messages | Phase 3.2 |
| Jul 31, 2026 | Phase 3.2 — Calendar, Menu, Daily news | Phase 3.3 |
| Jul 31, 2026 | Phase 3.3 — Activities, Special Events, Rainy Day | Phase 3.4 |

---

## Quick reference — what to say each session

**Completed:** Phases 0–2, Phase 3.1–3.3  
**Previous step:** Phase 3.3 — Activities, Special Events, Rainy Day  
**Current step:** Phase 3.4 — Appointments, Incident Reports, Reports  
**Future:** Phases 5–8  

**Rules:** No step starts without Ansar’s OK. **Web + mobile ship together** for every day-camp step.
